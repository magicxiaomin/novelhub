/**
 * Runtime-agnostic domain error. Services throw `DomainError` with a status
 * code; the Nest `DomainErrorFilter` (registered globally in `main.ts`) maps
 * to the matching `HttpException`, and the Hono `app.onError` handler in
 * `worker.ts` maps to the matching `HTTPException`. Service code never
 * imports `@nestjs/common`, so the same `*.service.ts` files run on both
 * the Node + Nest stack and the Cloudflare Worker.
 *
 * Was named `AuthError` in PRs #70/#71 when only the auth module needed it;
 * generalised here for Task 4 (catalog services) which throw notFound /
 * forbidden in addition to the original auth statuses.
 */
export type DomainErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

export class DomainError extends Error {
  constructor(
    public readonly status: DomainErrorStatus,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }

  static badRequest(msg: string): DomainError {
    return new DomainError(400, msg);
  }

  static unauthorized(msg = 'Unauthorized'): DomainError {
    return new DomainError(401, msg);
  }

  static forbidden(msg = 'Forbidden'): DomainError {
    return new DomainError(403, msg);
  }

  static notFound(msg = 'Not Found'): DomainError {
    return new DomainError(404, msg);
  }

  static conflict(msg: string): DomainError {
    return new DomainError(409, msg);
  }

  static internal(msg: string): DomainError {
    return new DomainError(500, msg);
  }
}
