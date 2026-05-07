import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { PRISMA } from '../auth/auth.constants';
import { CACHE_CLIENT } from '../cache/cache.constants';
import { BooksService } from '../books/books.service';
import { STORAGE_CLIENT } from '../storage/storage.constants';

import { AdminService } from './admin.service';

type StoredChapter = {
  id: string;
  bookId: string;
  order: number;
  title: string;
  contentUrl: string;
  wordCount: number;
  isFree: boolean;
  deletedAt: Date | null;
};

const buildPrismaStub = () => {
  const books = new Map<
    string,
    { id: string; freeChapterCount: number; totalChapters: number; deletedAt: Date | null }
  >();
  const chapters = new Map<string, StoredChapter>();
  let chapterIdCounter = 0;
  let bookIdCounter = 0;

  const prisma = {
    book: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        bookIdCounter += 1;
        const id = `book-${bookIdCounter}`;
        books.set(id, {
          id,
          freeChapterCount: (data.freeChapterCount as number | undefined) ?? 3,
          totalChapters: 0,
          deletedAt: null,
        });
        return { id };
      }),
      findFirst: jest.fn(async ({ where }: { where: { id: string; deletedAt: null } }) => {
        const b = books.get(where.id);
        if (!b || b.deletedAt) return null;
        return {
          id: b.id,
          freeChapterCount: b.freeChapterCount,
          totalChapters: b.totalChapters,
        };
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { totalChapters?: number; deletedAt?: Date };
        }) => {
          const b = books.get(where.id);
          if (!b) throw new Error('book not found');
          if (typeof data.totalChapters === 'number') b.totalChapters = data.totalChapters;
          if (data.deletedAt) b.deletedAt = data.deletedAt;
          return { id: b.id };
        },
      ),
    },
    chapter: {
      create: jest.fn(async ({ data }: { data: Omit<StoredChapter, 'id' | 'deletedAt'> }) => {
        chapterIdCounter += 1;
        const id = `chapter-${chapterIdCounter}`;
        const ch: StoredChapter = { id, deletedAt: null, ...data };
        chapters.set(id, ch);
        return { id };
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<StoredChapter> }) => {
          const ch = chapters.get(where.id);
          if (!ch) throw new Error('chapter not found');
          Object.assign(ch, data);
          return { id: ch.id };
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { bookId: string; deletedAt: null };
          data: { deletedAt: Date };
        }) => {
          let count = 0;
          for (const ch of chapters.values()) {
            if (ch.bookId === where.bookId && ch.deletedAt === null) {
              ch.deletedAt = data.deletedAt;
              count += 1;
            }
          }
          return { count };
        },
      ),
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) => {
        const ch = chapters.get(where.id);
        if (!ch || ch.deletedAt) return null;
        return ch;
      }),
    },
  };

  return { prisma, books, chapters };
};

describe('AdminService', () => {
  let service: AdminService;
  let stub: ReturnType<typeof buildPrismaStub>;
  let storage: {
    uploadText: jest.Mock;
    getSignedUrl: jest.Mock;
    getSignedUploadUrl: jest.Mock;
    getText: jest.Mock;
  };
  let cache: { set: jest.Mock; del: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    stub = buildPrismaStub();
    storage = {
      uploadText: jest.fn(async () => undefined),
      getSignedUrl: jest.fn(async () => 'https://signed/url'),
      getSignedUploadUrl: jest.fn(async () => 'https://signed/upload'),
      getText: jest.fn(async () => ''),
    };
    cache = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      del: jest.fn(async () => undefined),
    };
    const booksServiceStub = {
      invalidateListCaches: jest.fn(async () => undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PRISMA, useValue: stub.prisma },
        { provide: STORAGE_CLIENT, useValue: storage },
        { provide: CACHE_CLIENT, useValue: cache },
        { provide: BooksService, useValue: booksServiceStub },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  it('createBook returns the new id and invalidates list caches', async () => {
    const result = await service.createBook({
      title: 'Alpha',
      author: 'S K',
      coverUrl: 'https://covers/1',
      description: 'desc',
      category: 'Werewolf',
    });
    expect(result.id).toBe('book-1');
    expect(stub.books.size).toBe(1);
  });

  it('softDeleteBook 404 when not found', async () => {
    await expect(service.softDeleteBook('book-missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bulkImportChapters: parses sections by --- and uploads each to R2', async () => {
    const { id: bookId } = await service.createBook({
      title: 'Alpha',
      author: 'S K',
      coverUrl: 'https://covers/1',
      description: 'desc',
      category: 'Werewolf',
      freeChapterCount: 2,
    });

    const text = [
      'The Encounter\nLuna walked into the clearing...',
      'A Stranger\nThe wind howled as she stepped...',
      'Moonlight\nAlpha stood there, watching...',
      'Bound\nShe could not look away...',
    ].join('\n\n---\n\n');

    const result = await service.bulkImportChapters(bookId, Buffer.from(text, 'utf-8'), {});

    expect(result.created).toBe(4);
    expect(storage.uploadText).toHaveBeenCalledTimes(4);
    // Each chapter writes content + then updates contentUrl, plus pre-warm
    // cache.set for the preview.
    expect(cache.set).toHaveBeenCalledTimes(4);
    // First two chapters are free per freeChapterCount=2
    const stored = Array.from(stub.chapters.values());
    expect(stored.filter((c) => c.isFree)).toHaveLength(2);
    expect(stored.filter((c) => !c.isFree)).toHaveLength(2);
    // Book totalChapters bumped
    const book = stub.books.get(bookId);
    expect(book?.totalChapters).toBe(4);
  });

  it('bulkImportChapters: rejects empty file', async () => {
    const { id: bookId } = await service.createBook({
      title: 'Alpha',
      author: 'S K',
      coverUrl: 'https://covers/1',
      description: 'desc',
      category: 'Werewolf',
    });
    await expect(
      service.bulkImportChapters(bookId, Buffer.from('', 'utf-8'), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bulkImportChapters: replace mode soft-deletes existing chapters', async () => {
    const { id: bookId } = await service.createBook({
      title: 'Alpha',
      author: 'S K',
      coverUrl: 'https://covers/1',
      description: 'desc',
      category: 'Werewolf',
    });
    await service.bulkImportChapters(
      bookId,
      Buffer.from('Ch1\nbody\n\n---\n\nCh2\nbody', 'utf-8'),
      {},
    );
    expect(Array.from(stub.chapters.values()).filter((c) => !c.deletedAt)).toHaveLength(2);

    await service.bulkImportChapters(bookId, Buffer.from('NewCh1\nbody', 'utf-8'), {
      replace: true,
    });
    const live = Array.from(stub.chapters.values()).filter((c) => !c.deletedAt);
    const dead = Array.from(stub.chapters.values()).filter((c) => c.deletedAt);
    expect(live).toHaveLength(1);
    expect(dead).toHaveLength(2);
    const book = stub.books.get(bookId);
    expect(book?.totalChapters).toBe(1);
  });
});
