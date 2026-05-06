import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.EMAIL_FROM ?? 'NovelHub <noreply@novelhub.local>';
    this.client = apiKey ? new Resend(apiKey) : null;
    if (!this.client) {
      this.logger.warn('RESEND_API_KEY not set — emails will be skipped (logged only).');
    }
  }

  async sendWelcomeEmail(to: string): Promise<void> {
    const subject = 'Welcome to NovelHub';
    const html = `
      <h1>Welcome to NovelHub</h1>
      <p>Your account is ready. We've added 20 coins to get you started — happy reading.</p>
    `;
    await this.send(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your NovelHub password';
    const html = `
      <h1>Reset your password</h1>
      <p>Click the link below to set a new password. This link expires in one hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
    `;
    await this.send(to, subject, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.client) {
      this.logger.log(`[email-skip] to=${to} subject="${subject}"`);
      return;
    }
    try {
      await this.client.emails.send({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err as Error);
    }
  }
}
