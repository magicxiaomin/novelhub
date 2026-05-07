import { messages } from '@novelhub/shared';

export default function AboutPage(): JSX.Element {
  return (
    <article className="prose mx-auto max-w-prose px-4 py-12">
      <h1>{messages.legal.aboutTitle}</h1>
      <p>{messages.legal.todo}</p>
      <p>{messages.legal.lastUpdated}</p>
      <p>{messages.legal.aboutBodyOne}</p>
      <p>{messages.legal.aboutBodyTwo}</p>
    </article>
  );
}
