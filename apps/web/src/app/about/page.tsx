import { messages } from '@novelhub/shared';

export default function AboutPage(): JSX.Element {
  return (
    <article className="prose mx-auto max-w-prose px-4 py-12">
      <h1>{messages.legal.aboutTitle}</h1>
    </article>
  );
}
