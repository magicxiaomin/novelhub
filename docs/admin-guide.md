# Admin Guide

## Add A Book

Open `/admin/books/new`, enter the title, author, description, category, chapter pricing, and status. Status must be `ONGOING` or `COMPLETED`. The free chapter count defaults to `3`; change it only when the acquisition funnel requires a different free preview.

Covers are required. Upload the cover first, then save the book only after the cover key is attached.

## Cover Uploads

The admin UI requests a presigned upload URL from the API, uploads the file with `PUT`, then patches the book with the returned object key. `coverUrl` is derived automatically from `R2_PUBLIC_HOST`; admins should not paste public URLs manually.

## Bulk-Import Chapters

Open the book in the admin panel and use bulk import. Supported sources are `.txt` files split by the `^Chapter \d+` delimiter or `.docx` files parsed by the importer. The UI chunks imports at 25 chapters per request so large books do not exceed API request limits.

Review chapter numbers, titles, and free/paid status before confirming. Re-importing is intended for new chapter batches, not blind replacement of already-sold chapter content.

Chapter order assignment is append-only against the historical maximum order for the book. Soft-deleted/tombstoned chapter rows keep their old order slots reserved, so non-replace and replace imports both start after the highest existing or deleted chapter order rather than reusing gaps or relying on the active `totalChapters` count.

## Push Broadcasts

Open the push broadcast tool, compose the title and body, and leave the segment as `All` unless a narrower segment is explicitly required. The confirmation dialog shows the final audience and copy; send only after verifying both.

## Ban And Unban Users

Find the user in the admin user list. Banning blocks future authenticated activity while preserving purchase and audit history. Unban only after reviewing the reason and confirming the account should regain access.

## Operational Notes

Admin endpoints are JWT cookie-authenticated, admin-guarded, and rate-limited. Use the production admin panel over HTTPS only.
