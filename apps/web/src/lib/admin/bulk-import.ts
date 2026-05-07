export type ParsedChapter = {
  title: string;
  content: string;
};

export function parseChaptersFromText(text: string, regexSource: string): ParsedChapter[] {
  const regex = new RegExp(regexSource, 'gim');
  const matches = Array.from(text.matchAll(regex));
  if (matches.length === 0) {
    const trimmed = text.trim();
    return trimmed ? [{ title: 'Chapter 1', content: trimmed }] : [];
  }

  return matches
    .map((match, index) => {
      const start = match.index ?? 0;
      const next = matches[index + 1]?.index ?? text.length;
      const section = text.slice(start, next).trim();
      const firstLine = section.split(/\r?\n/, 1)[0]?.trim() || `Chapter ${index + 1}`;
      return { title: firstLine.slice(0, 200), content: section };
    })
    .filter((chapter) => chapter.content.length > 0);
}
