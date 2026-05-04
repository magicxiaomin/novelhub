# Ticket 03: Authentication API

## Goal
Implement user registration, login, JWT auth, and Google OAuth in NestJS.

## Tasks
1. Create `auth` module in `apps/api/src/modules/auth`
2. Implement endpoints:
   - `POST /auth/register` - email + password
   - `POST /auth/login` - email + password
   - `POST /auth/google` - Google OAuth ID token verification
   - `POST /auth/refresh` - refresh JWT
   - `POST /auth/logout` - clear cookies
   - `GET /auth/me` - current user info (requires auth)
   - `POST /auth/forgot-password` - send reset email
   - `POST /auth/reset-password` - reset with token
3. JWT in HTTP-only secure cookie, refresh token in separate cookie
4. Use `@nestjs/passport` with custom JWT strategy
5. Password hashing with bcrypt cost 12
6. On registration, grant 20 coins as signup bonus (creates a CoinTransaction)
7. Send welcome email via Resend on registration
8. Create `JwtAuthGuard` and `OptionalAuthGuard` (for endpoints accepting both guest and user)
9. Add Swagger annotations
10. Write unit tests for AuthService and e2e test for register/login flow

## API Contracts

### POST /auth/register
Request: `{ email: string, password: string }`
Response 201: `{ user: { id, email, coinBalance } }`
Errors: 409 if email exists, 400 if validation fails

### POST /auth/login
Request: `{ email: string, password: string }`
Response 200: `{ user: { id, email, coinBalance } }`
Errors: 401 if invalid credentials

### POST /auth/google
Request: `{ idToken: string }`
Response 200: `{ user: ..., isNewUser: boolean }`

### GET /auth/me
Response 200: `{ user: { id, email, coinBalance, hasActiveSubscription: boolean } }`
Response 401 if not logged in

## Acceptance Criteria
- All endpoints work with curl/Postman
- JWT cookie set with `httpOnly`, `secure`, `sameSite=lax`
- Google OAuth verified via google-auth-library
- New users get 20 coin signup bonus + welcome email
- Tests pass with `pnpm --filter api test`

## Out of Scope
- Email verification flow (V2)
- 2FA
- Frontend integration (separate ticket)
