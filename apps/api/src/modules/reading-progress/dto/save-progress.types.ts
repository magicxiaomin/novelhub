/**
 * Plain type for the save-progress payload. The class-decorated version in
 * `save-progress.dto.ts` carries class-validator + swagger metadata for the
 * Nest controller pipeline. Service code imports the type from this file so
 * the Worker tsconfig (no experimentalDecorators) can type-check
 * `ReadingProgressService.save` without parsing decorators.
 */
export type SaveProgressDto = {
  chapterId: string;
  scrollPercent: number;
};
