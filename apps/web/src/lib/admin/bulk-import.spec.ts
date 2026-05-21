import { describe, expect, it } from 'vitest';

import { parseChaptersFromText } from './bulk-import';

describe('parseChaptersFromText', () => {
  it('splits text on Chapter N headings', () => {
    const result = parseChaptersFromText('Chapter 1\nOne\n\nChapter 2\nTwo', '^Chapter\\s+\\d+');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ title: 'Chapter 1', content: 'Chapter 1\nOne' });
    expect(result[1]?.title).toBe('Chapter 2');
  });

  it('returns a single fallback chapter with trimmed content when no heading matches', () => {
    expect(
      parseChaptersFromText(
        '\n\nNo chapter heading here.\nStill one chapter.\n',
        '^Chapter\\s+\\d+',
      ),
    ).toEqual([
      {
        title: 'Chapter 1',
        content: 'No chapter heading here.\nStill one chapter.',
      },
    ]);
  });

  it('returns no chapters for empty or whitespace-only input with no heading matches', () => {
    expect(parseChaptersFromText('', '^Chapter\\s+\\d+')).toEqual([]);
    expect(parseChaptersFromText(' \n\t\r\n ', '^Chapter\\s+\\d+')).toEqual([]);
  });

  it('keeps heading lines in each matched section and spans content to the next heading', () => {
    const result = parseChaptersFromText(
      'Prologue text ignored before first match\n\nChapter 1\nOne line\nStill chapter one\n\nChapter 2\nTwo line\nThe end',
      '^Chapter\\s+\\d+',
    );

    expect(result).toEqual([
      {
        title: 'Chapter 1',
        content: 'Chapter 1\nOne line\nStill chapter one',
      },
      {
        title: 'Chapter 2',
        content: 'Chapter 2\nTwo line\nThe end',
      },
    ]);
  });

  it('truncates matched-section titles to 200 characters', () => {
    const longTitle = `Chapter 1 ${'A'.repeat(250)}`;
    const [chapter] = parseChaptersFromText(`${longTitle}\nBody`, '^Chapter\\s+\\d+.*$');

    expect(chapter?.title).toHaveLength(200);
    expect(chapter?.title).toBe(longTitle.slice(0, 200));
    expect(chapter?.content).toBe(`${longTitle}\nBody`);
  });

  it('honors case-insensitive and multiline heading matches from the gim flags', () => {
    const result = parseChaptersFromText(
      'Preface ignored because it precedes the first match\nchapter 1\nLowercase heading body\nCHAPTER 2\nUppercase heading body',
      '^chapter\\s+\\d+',
    );

    expect(result).toEqual([
      {
        title: 'chapter 1',
        content: 'chapter 1\nLowercase heading body',
      },
      {
        title: 'CHAPTER 2',
        content: 'CHAPTER 2\nUppercase heading body',
      },
    ]);
  });

  it('filters empty matched sections before returning chapters', () => {
    expect(parseChaptersFromText('\nChapter 1\nOne', '^$|^Chapter\\s+\\d+')).toEqual([
      {
        title: 'Chapter 1',
        content: 'Chapter 1\nOne',
      },
    ]);
  });
});
