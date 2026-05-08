export type AdminPaginationDto = {
  page?: number;
  limit?: number;
};

export type AdminSearchDto = AdminPaginationDto & {
  search?: string;
};

export type AdminChapterListDto = AdminPaginationDto & {
  bookId?: string;
};

export type AdminOrderListDto = AdminSearchDto & {
  status?: string;
};

export type CoverUploadUrlDto = {
  contentType?: string;
};
