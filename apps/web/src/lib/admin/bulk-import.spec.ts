import { describe, expect, it } from 'vitest';

import { parseChaptersFromText } from './bulk-import';

describe('parseChaptersFromText', () => {
  it('splits text on Chapter N headings', () => {
    const result = parseChaptersFromText('Chapter 1\nOne\n\nChapter 2\nTwo', '^Chapter\\s+\\d+');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ title: 'Chapter 1', content: 'Chapter 1\nOne' });
    expect(result[1]?.title).toBe('Chapter 2');
  });
});
