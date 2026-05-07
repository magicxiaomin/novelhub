import messages from '@/../messages/en.json';

export default function DmcaPage(): JSX.Element {
  return (
    <article className="prose mx-auto max-w-prose px-4 py-12">
      <h1>{messages.legal.dmcaTitle}</h1>
      <p>{messages.legal.todo}</p>
      <p>{messages.legal.lastUpdated}</p>
      <p>{messages.legal.dmcaPlaceholder}</p>
      {/* TODO: replace placeholder takedown email with the reviewed legal address. */}
      <p>
        <a href="mailto:dmca@novelhub.app">{messages.legal.dmcaEmail}</a>
      </p>
    </article>
  );
}
