// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

import { absoluteAppUrl, appBaseUrl } from './site-url';

describe('site URL helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['unset', undefined],
    ['blank', '   '],
    ['invalid', 'not a url'],
  ])('falls back to localhost when NEXT_PUBLIC_APP_URL is %s', (_label, value) => {
    if (value === undefined) {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);
    } else {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', value);
    }

    expect(appBaseUrl()).toBe('http://localhost:3000');
  });

  it('normalizes valid env URLs to their origin without trailing slashes', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '  https://preview.example.test:8443/base/path///  ');

    expect(appBaseUrl()).toBe('https://preview.example.test:8443');
  });

  it.each([
    ['/', 'https://preview.example.test/'],
    ['/path', 'https://preview.example.test/path'],
    ['path', 'https://preview.example.test/path'],
  ])('builds the current absoluteAppUrl output for %s', (path, expected) => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.example.test/app/');

    expect(absoluteAppUrl(path)).toBe(expected);
  });

  it.each([
    [
      '/books/1?utm_source=ad#chapter-2',
      'https://preview.example.test/books/1?utm_source=ad#chapter-2',
    ],
    [
      'books/1?utm_source=ad#chapter-2',
      'https://preview.example.test/books/1?utm_source=ad#chapter-2',
    ],
  ])('preserves query strings and hashes for %s', (path, expected) => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.example.test/app/');

    expect(absoluteAppUrl(path)).toBe(expected);
  });

  it.each([
    ['/library//continue///chapter', 'https://preview.example.test/library//continue///chapter'],
    ['library//continue///chapter', 'https://preview.example.test/library//continue///chapter'],
  ])('preserves duplicate slashes inside relative paths for %s', (path, expected) => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.example.test/app/');

    expect(absoluteAppUrl(path)).toBe(expected);
  });

  it('treats already-absolute URL input as an app-relative path snapshot', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://preview.example.test/app/');

    expect(absoluteAppUrl('https://external.example.test/books/1?ref=ad#top')).toBe(
      'https://preview.example.test/https://external.example.test/books/1?ref=ad#top',
    );
  });
});
