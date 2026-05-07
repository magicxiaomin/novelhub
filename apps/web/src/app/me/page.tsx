import type { Metadata } from 'next';

import { MeClient } from './me-client';
import { messages } from '@novelhub/shared';

export const metadata: Metadata = {
  title: messages.account.title,
};

export default function MePage(): JSX.Element {
  return <MeClient />;
}
