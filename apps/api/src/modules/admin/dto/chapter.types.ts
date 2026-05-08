export type UpdateChapterDto = {
  title?: string;
  isFree?: boolean;
  order?: number;
  content?: string;
};

export type BulkImportOptionsDto = {
  delimiter?: string;
  replace?: boolean;
};

export type BulkChapterDto = {
  title: string;
  content: string;
  isFree?: boolean;
};

export type BulkCreateChaptersDto = {
  chapters: BulkChapterDto[];
};
