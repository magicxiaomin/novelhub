/**
 * Domain error for AuthService. The Nest controller catches it and rethrows
 * as the appropriate HttpException; the future Hono routes catch it and
 * rethrow as HTTPException. AuthService itself stays runtime-agnostic.
 */
export class AuthError extends Error {
  constructor(
    public readonly status: 400 | 401 | 409 | 500,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }

  static badRequest(msg: string): AuthError {
    return new AuthError(400, msg);
  }

  static unauthorized(msg = 'Unauthorized'): AuthError {
    return new AuthError(401, msg);
  }

  static conflict(msg: string): AuthError {
    return new AuthError(409, msg);
  }

  static internal(msg: string): AuthError {
    return new AuthError(500, msg);
  }
}
