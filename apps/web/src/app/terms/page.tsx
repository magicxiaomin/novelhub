import messages from '@/../messages/en.json';

export default function TermsPage(): JSX.Element {
  return (
    <article className="prose mx-auto max-w-prose px-4 py-12">
      <h1>{messages.legal.termsTitle}</h1>
      <p>{messages.legal.todo}</p>
      <p>{messages.legal.lastUpdated}</p>
      <p>{messages.legal.termsPlaceholder}</p>
    </article>
  );
}
