import type { Provider } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { GOOGLE_OAUTH_CLIENT } from '../auth.constants';

/**
 * Constructs the Google OAuth2 client used to verify ID tokens.
 * `verifyIdToken` will fail at request time if `GOOGLE_CLIENT_ID` is unset,
 * so missing env vars surface as a 401 instead of a boot-time crash.
 */
export const GoogleOAuthProvider: Provider = {
  provide: GOOGLE_OAUTH_CLIENT,
  useFactory: (): OAuth2Client => new OAuth2Client(process.env.GOOGLE_CLIENT_ID),
};
