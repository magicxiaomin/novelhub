/**
 * Workers-compatible email client. Mirrors the public surface of
 * apps/api/src/modules/auth/email.service.ts (`sendWelcomeEmail`,
 * `sendPasswordResetEmail`) so it satisfies `AuthServiceDeps['email']`
 * structurally — no need to import the Nest class at runtime in the Worker.
 *
 * Resend's SDK is fetch-based and works on Workers, but to keep the bundle
 * small we hit the REST endpoint directly with `fetch`.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export class EmailClient {
  private readonly apiKey: string | null;
  private readonly from: string;

  constructor(apiKey: string | undefined, from: string | undefined) {
    this.apiKey = apiKey?.trim() ? apiKey : null;
    this.from = from?.trim() ? from : 'NovelHub <noreply@novelhub.local>';
  }

  async sendWelcomeEmail(to: string): Promise<void> {
    await this.send(
      to,
      'Welcome to NovelHub',
      `<h1>Welcome to NovelHub</h1>
       <p>Your account is ready. We've added 20 coins to get you started — happy reading.</p>`,
    );
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send(
      to,
      'Reset your NovelHub password',
      `<h1>Reset your password</h1>
       <p>Click the link below to set a new password. This link expires in one hour.</p>
       <p><a href="${resetUrl}">${resetUrl}</a></p>
       <p>If you didn't request this, you can ignore this email.</p>`,
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      // Same fallback behavior as EmailService — log-and-skip when unconfigured.
      // eslint-disable-next-line no-console
      console.log(`[email-skip] to=${to} subject="${subject}"`);
      return;
    }
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error(`[EmailClient] resend send failed ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[EmailClient] resend network error`, err);
    }
  }
}
