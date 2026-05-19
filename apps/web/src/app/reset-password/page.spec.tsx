import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordPage, { metadata } from './page';
import { ResetPasswordClient } from './reset-password-client';

const { messages } = vi.hoisted(() => ({
  messages: {
    auth: {
      resetPageTitle: 'Reset your password',
    },
  } as const,
}));

vi.mock('@novelhub/shared', () => ({
  messages,
}));

vi.mock('./reset-password-client', () => ({
  ResetPasswordClient: vi.fn(({ token }: { token: string | null }) => (
    <section data-reset-password-client="true" data-token={token ?? 'missing'} />
  )),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('React', React);
});

describe('reset password page static render contract', () => {
  it('uses shared auth copy for page metadata', () => {
    expect(metadata).toMatchObject({
      title: messages.auth.resetPageTitle,
    });
  });

  it('passes a token query parameter to the client boundary during static render', () => {
    const html = renderToStaticMarkup(
      <ResetPasswordPage searchParams={{ token: 'reset-token-123' }} />,
    );

    expect(ResetPasswordClient).toHaveBeenCalledWith(
      { token: 'reset-token-123' },
      expect.anything(),
    );
    expect(html).toContain('data-reset-password-client="true"');
    expect(html).toContain('data-token="reset-token-123"');
  });

  it('normalizes a missing token query parameter to null for the invalid-link branch', () => {
    const html = renderToStaticMarkup(<ResetPasswordPage searchParams={{}} />);

    expect(ResetPasswordClient).toHaveBeenCalledWith({ token: null }, expect.anything());
    expect(html).toContain('data-reset-password-client="true"');
    expect(html).toContain('data-token="missing"');
  });
});
