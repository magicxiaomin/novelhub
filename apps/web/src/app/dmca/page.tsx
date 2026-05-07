import messages from '@/../messages/en.json';

export default function DmcaPage(): JSX.Element {
  const dmcaEmail = process.env.NEXT_PUBLIC_DMCA_EMAIL ?? 'dmca@example.com';
  return (
    <article className="prose mx-auto max-w-prose px-4 py-12">
      <h1>{messages.legal.dmcaTitle}</h1>
      <p>{messages.legal.todo}</p>
      <p>{messages.legal.lastUpdated}</p>
      <p>{messages.legal.dmcaPlaceholder}</p>
      <p>
        <a href={`mailto:${dmcaEmail}`}>
          {messages.legal.dmcaEmailLabel.replaceAll('{email}', () => dmcaEmail)}
        </a>
      </p>
    </article>
  );
}
