import { clampFreeChapterLimit, configuredFreeChapterLimit } from './free-chapter-limit';

describe('free chapter limit', () => {
  it('clamps configured FREE_CHAPTER_LIMIT to the canonical 1-3 funnel range', () => {
    expect(configuredFreeChapterLimit('0')).toBe(1);
    expect(configuredFreeChapterLimit('2')).toBe(2);
    expect(configuredFreeChapterLimit('99')).toBe(3);
  });

  it('defaults invalid or absent FREE_CHAPTER_LIMIT values to three free chapters', () => {
    expect(configuredFreeChapterLimit(undefined)).toBe(3);
    expect(configuredFreeChapterLimit('not-a-number')).toBe(3);
  });

  it('clamps explicit admin values to the canonical funnel range', () => {
    expect(clampFreeChapterLimit(-1)).toBe(1);
    expect(clampFreeChapterLimit(1)).toBe(1);
    expect(clampFreeChapterLimit(3)).toBe(3);
    expect(clampFreeChapterLimit(4)).toBe(3);
  });
});
