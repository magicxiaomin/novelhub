# Drama deprecation contract

This contract records the short-drama route families that remain registered only as deprecated shims during the novels-only pivot. It mirrors the gate dispositions in `docs/pivot/quarantine-register.md` and exists to keep the API contract testable while `docs/adr/0001-novels-only-pivot.md` is the active product direction.

Characterization-only: this document describes the behavior locked by `apps/api/src/worker/routes/drama.contract.spec.ts`; it does not reactivate drama behavior, normalize route modules, change handler behavior, or alter any quarantine-register disposition. If a future implementation finds an inconsistency between drama route modules, document it and open a separate proposal for normalization rather than changing behavior in this contract.

| Route family             | Representative method(s)                                      | Status     | Headers                        | Body code          |
| ------------------------ | ------------------------------------------------------------- | ---------- | ------------------------------ | ------------------ |
| `/dramas`                | `GET /dramas`                                                 | `410 Gone` | `x-novelhub-deprecated: drama` | `DRAMA_DEPRECATED` |
| `/dramas/:slug`          | `GET /dramas/shadow-heiress`                                  | `410 Gone` | `x-novelhub-deprecated: drama` | `DRAMA_DEPRECATED` |
| `/episodes/:id/playback` | `GET /episodes/11111111-1111-4111-8111-111111111111/playback` | `410 Gone` | `x-novelhub-deprecated: drama` | `DRAMA_DEPRECATED` |
| `/episodes/:id/unlock`   | `POST /episodes/11111111-1111-4111-8111-111111111111/unlock`  | `410 Gone` | `x-novelhub-deprecated: drama` | `DRAMA_DEPRECATED` |
| `GET /drama-progress`    | `GET /drama-progress`                                         | `410 Gone` | `x-novelhub-deprecated: drama` | `DRAMA_DEPRECATED` |
| `POST /drama-progress`   | `POST /drama-progress`                                        | `410 Gone` | `x-novelhub-deprecated: drama` | `DRAMA_DEPRECATED` |

The contract intentionally excludes drama-admin paths because they route through admin code and are outside the public drama route families covered here.
