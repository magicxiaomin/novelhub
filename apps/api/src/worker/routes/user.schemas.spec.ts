import { listProgressQuerySchema, saveProgressBodySchema } from './user.schemas';

const uuidV4 = '123e4567-e89b-42d3-a456-426614174000';
const uuidV1 = '123e4567-e89b-12d3-a456-426614174000';
const invalidUuid = 'not-a-uuid';

describe('Worker reading-progress schemas', () => {
  describe('saveProgressBodySchema', () => {
    it('coerces valid scrollPercent values while preserving the chapter id', () => {
      expect(saveProgressBodySchema.parse({ chapterId: uuidV4, scrollPercent: '50.5' })).toEqual({
        chapterId: uuidV4,
        scrollPercent: 50.5,
      });
    });

    it.each([0, 100])('accepts scrollPercent boundary value %s', (scrollPercent) => {
      expect(saveProgressBodySchema.safeParse({ chapterId: uuidV4, scrollPercent }).success).toBe(
        true,
      );
    });

    it.each([-1, 101, Number.NaN])(
      'rejects out-of-range scrollPercent value %s',
      (scrollPercent) => {
        expect(saveProgressBodySchema.safeParse({ chapterId: uuidV4, scrollPercent }).success).toBe(
          false,
        );
      },
    );

    it.each([uuidV1, invalidUuid])('rejects non-v4 chapterId value %s', (chapterId) => {
      expect(saveProgressBodySchema.safeParse({ chapterId, scrollPercent: 50 }).success).toBe(
        false,
      );
    });

    it('rejects unknown body fields instead of silently accepting extra data', () => {
      expect(
        saveProgressBodySchema.safeParse({
          chapterId: uuidV4,
          scrollPercent: 50,
          extra: 'reject-me',
        }).success,
      ).toBe(false);
    });
  });

  describe('listProgressQuerySchema', () => {
    it('accepts an empty query and optional v4 identifiers', () => {
      expect(listProgressQuerySchema.parse({})).toEqual({});
      expect(listProgressQuerySchema.parse({ bookId: uuidV4, chapterId: uuidV4 })).toEqual({
        bookId: uuidV4,
        chapterId: uuidV4,
      });
    });

    it.each([
      { bookId: uuidV1 },
      { bookId: invalidUuid },
      { chapterId: uuidV1 },
      { chapterId: invalidUuid },
    ])('rejects non-v4 query identifiers %#', (query) => {
      expect(listProgressQuerySchema.safeParse(query).success).toBe(false);
    });

    it('rejects unknown query fields instead of silently accepting extra filters', () => {
      expect(
        listProgressQuerySchema.safeParse({ bookId: uuidV4, extra: 'reject-me' }).success,
      ).toBe(false);
    });
  });
});
