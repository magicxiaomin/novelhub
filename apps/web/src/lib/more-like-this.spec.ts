import { describe, expect, it } from 'vitest';

import { selectMoreLikeThisBooks } from './more-like-this';
import type { BookSummary } from './types';

const book = (id: string, category = 'Fantasy'): BookSummary => ({
  id,
  title: `Book ${id}`,
  author: 'NovelHub',
  coverUrl: `/covers/${id}.png`,
  category,
  tags: [],
  status: 'ONGOING',
  isFeatured: false,
  totalChapters: 12,
  freeChapterCount: 3,
  coinPerChapter: 10,
});

describe('selectMoreLikeThisBooks', () => {
  it('excludes the current book and returns the first four candidates in stable API order', () => {
    const selected = selectMoreLikeThisBooks('current', [
      book('a'),
      book('current'),
      book('b'),
      book('c'),
      book('d'),
      book('e'),
    ]);

    expect(selected.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it.each([
    ['zero', [book('current')]],
    ['one', [book('current'), book('a')]],
    ['two', [book('current'), book('a'), book('b')]],
  ])('returns [] when %s other candidates are available', (_label, candidates) => {
    const selected = selectMoreLikeThisBooks('current', candidates);

    expect(selected).toEqual([]);
  });
});
