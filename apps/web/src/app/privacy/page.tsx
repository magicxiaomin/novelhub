import { messages } from '@novelhub/shared';

export default function PrivacyPage(): JSX.Element {
  return (
    <article className="prose mx-auto max-w-prose px-4 py-12">
      <h1>{messages.legal.privacyTitle}</h1>
      <p>{messages.legal.todo}</p>
      <p>{messages.legal.lastUpdated}</p>
      <p>{messages.legal.placeholder}</p>
    </article>
  );
}
