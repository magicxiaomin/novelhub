# Worker read-path request logging contract

The Worker read-path middleware emits one structured JSON log line per handled read-path request. The log is intended for request tracing and operational debugging without exposing user-provided query strings or other PII.

## Event

`worker.read_request`

## Mounted read-path prefixes

The middleware is mounted only on public read-path routes. Current mounted prefixes are:

- `/books`
- `/books/*`
- `/chapters`
- `/chapters/*`

When adding a new public read-path prefix, use this same middleware only if the route can safely emit the fields below without including secrets, credentials, query strings, request bodies, response bodies, or user identifiers.

## Field contract

Field names are part of the public logging contract for downstream dashboards and alerts. Renaming a field is a breaking change. In particular, `path` must remain `path`; do not rename it to `pathname`, `route`, or similar without an explicitly approved migration.

| Field        | Type   | Description                                                                                |
| ------------ | ------ | ------------------------------------------------------------------------------------------ |
| `event`      | string | Always `worker.read_request`.                                                              |
| `requestId`  | string | The accepted incoming `x-request-id` header when valid, otherwise a generated request id.  |
| `method`     | string | HTTP method for the request.                                                               |
| `path`       | string | URL pathname only, excluding query string and fragment.                                    |
| `status`     | number | HTTP response status after the route handler completes, including handled error responses. |
| `durationMs` | number | Non-negative elapsed time in milliseconds.                                                 |

## PII expectations

The log line must not include query strings, request bodies, response bodies, emails, tokens, cookies, authorization headers, raw IP addresses, or user identifiers. The `path` field is restricted to the pathname so values such as `?token=...` and `?email=...` are excluded.

Example:

```json
{
  "event": "worker.read_request",
  "requestId": "req_1234567890abcdef",
  "method": "GET",
  "path": "/books/book-1",
  "status": 200,
  "durationMs": 3
}
```
