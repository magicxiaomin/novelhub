import type { Metadata } from 'next';

import { ResetPasswordClient } from './reset-password-client';
import { messages } from '@novelhub/shared';

export const metadata: Metadata = {
  title: messages.auth.resetPageTitle,
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}): JSX.Element {
  return <ResetPasswordClient token={searchParams.token ?? null} />;
}
