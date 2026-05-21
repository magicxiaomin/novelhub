# Admin Guide

## Add A Book

Open `/admin/books/new`, enter the title, author, description, category, chapter pricing, and status. Status must be `ONGOING` or `COMPLETED`. The free chapter count defaults to `3`; change it only when the acquisition funnel requires a different free preview.

Covers are required. Upload the cover first, then save the book only after the cover key is attached.

## Cover Uploads

The admin UI requests a presigned upload URL from the API, uploads the file with `PUT`, then patches the book with the returned object key. `coverUrl` is derived automatically from `R2_PUBLIC_HOST`; admins should not paste public URLs manually.

## Bulk-Import Chapters

Open the book in the admin panel and use bulk import. Repository inspection for #596 verified that the local admin UI accepts `.txt` and `.docx` files: `.docx` files are converted to raw text with Mammoth, other files use browser text reading, and parsed text is split with the default `^Chapter\s+\d+` expression unless the operator changes the field. The UI submits parsed chapters in chunks of 25 per request to stay below backend content/body limits.

Review chapter numbers, titles, and free/paid status before confirming. Re-importing is intended for new chapter batches, not blind replacement of already-sold chapter content. Do not use this guide to run staging or production imports; live imports require a separate approved ticket.

Chapter order assignment is append-only against the historical maximum order for the book. Soft-deleted/tombstoned chapter rows keep their old order slots reserved, so non-replace imports and replace-style service imports both start after the highest existing or deleted chapter order rather than reusing gaps or relying on the active `totalChapters` count.

For the read-only #566/#594 traceability runbook, verified cleanup behavior, safe local test commands, and hard exclusions, see `docs/pivot/wave-2ar-admin-import-runbook.md`.

## Push Broadcasts

Open the push broadcast tool, compose the title and body, and leave the segment as `All` unless a narrower segment is explicitly required. The confirmation dialog shows the final audience and copy; send only after verifying both.

## Ban And Unban Users

Find the user in the admin user list. Banning blocks future authenticated activity while preserving purchase and audit history. Unban only after reviewing the reason and confirming the account should regain access.

## Operational Notes

Admin endpoints are JWT cookie-authenticated, admin-guarded, and rate-limited. Use the production admin panel over HTTPS only.
