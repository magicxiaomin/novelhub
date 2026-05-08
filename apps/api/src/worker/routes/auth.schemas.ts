/**
 * Zod schemas for the Hono auth routes — mirror the class-validator
 * constraints in `apps/api/src/modules/auth/dto/*.ts` so validation parity
 * holds between the Nest stack on `:4000` and the Worker on `:8787`. The
 * Nest controller still consumes the class-validator DTOs unchanged; these
 * are Worker-only.
 *
 * Status codes intentionally match the Nest stack: bad bodies → 400 with a
 * `{message}` payload (zValidator's default), missing/invalid auth → 401.
 */
import { z } from 'zod';

// `z.string().email()` enforces RFC 5322 shape; pair with `.max(254)` to
// match the existing `MaxLength(254)` decorator across DTOs.
const emailField = z.string().email().max(254);

// Login accepts any non-empty password up to 128 chars (no minimum) so that
// users with legacy passwords below today's 8-char bar can still sign in
// — `LoginDto` has `MaxLength(128)` only.
const loginPasswordField = z.string().min(1).max(128);

// All other password-bearing flows enforce the 8–128 charrange.
const strongPasswordField = z.string().min(8).max(128);

// Optional FB event id field — when present must be a v4 UUID and ≤64 chars
// (the upper bound matches the `MaxLength(64)` on RegisterDto).
const fbEventIdField = z.string().uuid().max(64).optional();

export const registerSchema = z.object({
  email: emailField,
  password: strongPasswordField,
  fbEventId: fbEventIdField,
});

export const loginSchema = z.object({
  email: emailField,
  password: loginPasswordField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: strongPasswordField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
