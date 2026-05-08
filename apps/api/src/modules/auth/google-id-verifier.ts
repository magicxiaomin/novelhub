import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export type GoogleIdPayload = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
};

export type GoogleIdVerifier = {
  verifyIdToken(args: { idToken: string; audience: string }): Promise<{
    getPayload(): GoogleIdPayload;
  }>;
};

export function createGoogleIdVerifier(): GoogleIdVerifier {
  const jwks = createRemoteJWKSet(new URL(JWKS_URI));
  return {
    async verifyIdToken({ idToken, audience }) {
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: Array.from(ISSUERS),
        audience,
      });
      const p = payload as JWTPayload & GoogleIdPayload;
      return {
        getPayload: () => ({ sub: p.sub, email: p.email, email_verified: p.email_verified }),
      };
    },
  };
}
