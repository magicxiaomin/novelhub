# Wave 2AR admin import runbook — read-only traceability

This runbook records the repository behavior verified for #596 after #566 was closed by PR #594. It is descriptive documentation only. It does not authorize a staging or production import, live data mutation, destructive database/R2 cleanup, schema change, environment/secret change, DNS/CDN/certificate change, Stripe mutation, or drama reactivation.

## Traceability

- Parent issue: #230.
- Original staging-import bug: #566 (`Fix staging admin chapter import for real public-domain books`) is closed by merged PR #594 (`fix(api): make chapter import atomic`, merge commit `e83d6ee`).
- Wave 2AR-B issue: #596 documents the read-only runbook and traceability cleanup after #566/#594. It is hardening/docs work, not an approval to run imports.

## Verified repository behavior

Repository inspection on the #594 baseline shows two admin chapter import paths with different callers but the same safety shape:

- The admin UI at `apps/web/src/app/admin/chapters/import/page.tsx` accepts `.txt` and `.docx`. `.docx` files are converted to raw text with `mammoth.extractRawText`; other files use `file.text()`.
- The UI default split expression is `^Chapter\s+\d+`, implemented by `parseChaptersFromText()` in `apps/web/src/lib/admin/bulk-import.ts` with `gim` flags. If no headings match, non-empty text becomes one chapter.
- The UI sends parsed chapters to `adminApi.bulkChapters()` in chunks of 25 chapters (`CHUNK_SIZE = 25`). The comment ties this to the API's 200 KB chapter cap and 10 MB JSON body cap.
- `AdminService.bulkCreateChapters()` uploads every chapter body to storage before opening the Prisma transaction. Inside the transaction it reads the historical maximum `chapter.order` for the book with `where: { bookId }`, so soft-deleted/tombstoned rows remain part of the max-order calculation and their order slots are not reused.
- If the DB transaction fails after uploads, `bulkCreateChapters()` calls `cleanupUploadedChapterKeys()` for the uploaded keys, logs the cleaned keys, and rethrows. `cleanupUploadedChapterKeys()` attempts each `storage.deleteObject()` independently and logs any cleanup miss as `failed to clean uploaded chapter key: <key>` without masking the original failure.
- `AdminService.bulkImportChapters()` is the file-bytes service path. It decodes text, splits by the provided delimiter/default delimiter, uploads parsed chapter bodies first, then performs the replace/append DB work in a transaction. On upload failure or transaction failure it attempts cleanup of already uploaded keys and logs the cleaned key list before rethrowing.
- For `bulkImportChapters({ replace: true })`, the transaction first soft-deletes currently active chapters (`deletedAt: null`) and then creates the new rows. New row order still starts after the historical max order captured before replacement, so tombstone order slots are not reused. For non-replace imports, new rows are appended after the historical max order as well.

## Operator boundary

Safe local verification for this runbook is limited to repository inspection and local automated tests. Do not use this runbook to perform live imports or deletes.

Hard exclusions:

- No production deploy, DNS, CDN, certificate, environment, or secret changes.
- No live Stripe/payment mutation.
- No destructive database, data, schema, Prisma migration, R2, or KV action.
- No staging or production admin import unless a separate approved ticket explicitly authorizes it.
- No live R2 orphan deletion from this document.
- No short-drama reactivation.
- Do not touch or unblock #233, #354, #394, or #395.

Safe local commands:

```bash
pnpm --filter @novelhub/api test -- admin.service.spec.ts r2-storage.spec.ts --runInBand
pnpm --filter @novelhub/api typecheck
```

Use the targeted API test command when changing behavior claims or snippets in this runbook. Use the API typecheck only when TypeScript references or examples change. Docs-only edits may also be reviewed by markdown diff without any live smoke/import.

## Notes and uncertainty

The `.docx`, `^Chapter\s+\d+`, and 25-chapter chunking claims above were verified against the current repository files named in this runbook. They describe the local admin UI parsing path, not an operational guarantee that arbitrary public-domain source files will import successfully in staging or production.
