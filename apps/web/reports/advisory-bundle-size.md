# Advisory bundle-size report

Generated: 2026-05-18T02:31:01.808Z

Advisory only: this report records bundle output and does not enforce CI thresholds.

| Route      | JS assets | Total size |
| ---------- | --------: | ---------: |
| /          |        16 |  613.7 KiB |
| /novels    |        15 |  585.2 KiB |
| /book/[id] |        15 |  594.8 KiB |
| /me        |        15 |  599.6 KiB |

Source: local Next.js build manifests under apps/web/.next/. Run after pnpm --filter @novelhub/web build or pnpm --filter @novelhub/web pages:build.
Rollback: revert the PR that added this advisory report/test bundle.
