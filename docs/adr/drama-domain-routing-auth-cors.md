# ADR: Drama domain routing auth/CORS foundation

## Context

Phase 3 introduces a drama-first web variant at `dramavela.com` / `www.dramavela.com` and preserves the existing novel experience at `novel.dramavela.com`. Browser calls include HTTP-only auth cookies, so API CORS must be an explicit credentialed allowlist; wildcard origins are not valid with cookies.

## Decision

- Use `NEXT_PUBLIC_API_BASE_URL` as the canonical browser/RSC API base URL.
- Keep `NEXT_PUBLIC_API_URL` as a compatibility fallback during deployment cutover.
- Keep credentialed CORS allowlisted by `NEXT_PUBLIC_APP_URL` plus comma-separated `CORS_EXTRA_ORIGINS`.
- Keep auth cookies host-only by default.
- Add optional `AUTH_COOKIE_DOMAIN`, validated before writing, for an explicitly approved shared-auth deployment such as `.dramavela.com`.

## Cookie-domain risk assessment

Shared cookie domain (`Domain=.dramavela.com`) would send the same JWT cookies to `dramavela.com`, `www.dramavela.com`, and `novel.dramavela.com`. That can be useful for SSO, but it also couples the drama and novel variants and broadens auth-cookie exposure to every subdomain under the registrable domain.

For the initial domain-routing foundation, host-only cookies are safer and require no DNS cutover or production secret changes. Claude review agreed this is the safer MVP default because widening cookie scope later is a deliberate config change, while narrowing from shared-domain cookies later can silently log users out and leaves more subdomain blast radius in the meantime. Operators should set `AUTH_COOKIE_DOMAIN=.dramavela.com` only after confirming that shared login across all variants is intended.

## Suggested production env shape

Drama-first web deployment:

```env
NEXT_PUBLIC_APP_URL=https://dramavela.com
NEXT_PUBLIC_API_BASE_URL=https://api.dramavela.com
CORS_EXTRA_ORIGINS=https://www.dramavela.com,https://novel.dramavela.com
AUTH_COOKIE_DOMAIN=
```

Novel variant deployment:

```env
NEXT_PUBLIC_APP_URL=https://novel.dramavela.com
NEXT_PUBLIC_API_BASE_URL=https://api.dramavela.com
CORS_EXTRA_ORIGINS=https://dramavela.com,https://www.dramavela.com
AUTH_COOKIE_DOMAIN=
```

If shared auth is explicitly approved later:

```env
AUTH_COOKIE_DOMAIN=.dramavela.com
```
