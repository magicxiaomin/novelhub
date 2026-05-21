/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { messages } from '@novelhub/shared';
import { adminApi } from '@/lib/admin/api';
import { toast } from 'sonner';

vi.mock('@/lib/admin/api', () => ({
  adminApi: {
    bulkChapters: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedBulkChapters = vi.mocked(adminApi.bulkChapters);
const mockedToastError = vi.mocked(toast.error);
const mockedToastSuccess = vi.mocked(toast.success);

const validBookId = '11111111-1111-4111-8111-111111111111';

function textFile(text: string, name = 'chapters.txt'): File {
  const file = new File([text], name, { type: 'text/plain' });
  Object.defineProperty(file, 'text', {
    configurable: true,
    value: vi.fn().mockResolvedValue(text),
  });
  return file;
}

async function renderPage(): Promise<void> {
  const { default: ImportChaptersPage } = await import('./page');

  render(<ImportChaptersPage />);
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Unable to find chapter import file input');
  }

  return input;
}

function bookIdInput(): HTMLInputElement {
  return screen.getByPlaceholderText(messages.admin.chapters.bookId);
}

function createButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: messages.admin.actions.create });
}

async function parseTxt(text: string, expectedCount: number): Promise<void> {
  fireEvent.change(fileInput(), { target: { files: [textFile(text)] } });
  await waitFor(() =>
    expect(
      screen.getByText(messages.admin.chapters.parsed.replace('{count}', String(expectedCount))),
    ).toBeInTheDocument(),
  );
}

function chaptersText(count: number): string {
  return Array.from(
    { length: count },
    (_, index) => `Chapter ${index + 1}\nBody ${index + 1}`,
  ).join('\n\n');
}

beforeEach(() => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockedBulkChapters.mockResolvedValue({ created: 0 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Reflect.deleteProperty(globalThis, 'React');
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});

describe('ImportChaptersPage', () => {
  it('renders the import form with no parsed chapters and a disabled submit button', async () => {
    await renderPage();

    expect(screen.getByText(messages.admin.chapters.import)).toBeInTheDocument();
    expect(bookIdInput()).toHaveAttribute('placeholder', messages.admin.chapters.bookId);
    expect(screen.getByPlaceholderText(messages.admin.chapters.regex)).toHaveValue(
      '^Chapter\\s+\\d+',
    );
    expect(
      screen.getByText(messages.admin.chapters.parsed.replace('{count}', '0')),
    ).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute('accept', '.txt,.docx');
    expect(createButton()).toBeDisabled();
  });

  it('parses a .txt file and enables submit', async () => {
    await renderPage();

    await parseTxt(chaptersText(2), 2);

    expect(
      screen.getByText(messages.admin.chapters.parsed.replace('{count}', '2')),
    ).toBeInTheDocument();
    expect(createButton()).toBeEnabled();
    expect(mockedBulkChapters).not.toHaveBeenCalled();
  });

  it('submits 25 or fewer chapters in a single bulk call and shows a success toast', async () => {
    await renderPage();
    await parseTxt(chaptersText(3), 3);
    fireEvent.change(bookIdInput(), { target: { value: validBookId } });

    fireEvent.click(createButton());

    await waitFor(() => expect(mockedBulkChapters).toHaveBeenCalledTimes(1));
    expect(mockedBulkChapters).toHaveBeenCalledWith(
      validBookId,
      expect.arrayContaining([
        { title: 'Chapter 1', content: 'Chapter 1\nBody 1' },
        { title: 'Chapter 2', content: 'Chapter 2\nBody 2' },
        { title: 'Chapter 3', content: 'Chapter 3\nBody 3' },
      ]),
    );
    expect(mockedBulkChapters.mock.calls[0]?.[1]).toHaveLength(3);
    expect(mockedToastSuccess).toHaveBeenCalledWith(
      messages.admin.chapters.imported.replace('{count}', '3'),
    );
    expect(mockedToastError).not.toHaveBeenCalled();
  });

  it('chunks more than 25 chapters with a maximum chunk size of 25', async () => {
    await renderPage();
    await parseTxt(chaptersText(52), 52);
    fireEvent.change(bookIdInput(), { target: { value: validBookId } });

    fireEvent.click(createButton());

    await waitFor(() => expect(mockedBulkChapters).toHaveBeenCalledTimes(3));
    expect(mockedBulkChapters.mock.calls.map(([, chapters]) => chapters.length)).toEqual([
      25, 25, 2,
    ]);
    expect(mockedBulkChapters.mock.calls.every(([bookId]) => bookId === validBookId)).toBe(true);
    expect(mockedToastSuccess).toHaveBeenCalledWith(
      messages.admin.chapters.imported.replace('{count}', '52'),
    );
  });

  it('stops after the first failed chunk and shows the partial-error toast', async () => {
    mockedBulkChapters.mockRejectedValueOnce(new Error('bulk failed'));
    await renderPage();
    await parseTxt(chaptersText(30), 30);
    fireEvent.change(bookIdInput(), { target: { value: validBookId } });

    fireEvent.click(createButton());

    await waitFor(() => expect(mockedBulkChapters).toHaveBeenCalledTimes(1));
    expect(mockedBulkChapters.mock.calls[0]?.[1]).toHaveLength(25);
    expect(mockedToastError).toHaveBeenCalledWith(
      messages.admin.chapters.importPartial
        .replace('{imported}', '0')
        .replace('{total}', '30')
        .replace('{message}', 'bulk failed'),
    );
    expect(mockedToastSuccess).not.toHaveBeenCalled();
  });

  it('keeps zod validation failures from calling bulk import', async () => {
    await renderPage();
    await parseTxt(chaptersText(1), 1);
    fireEvent.change(bookIdInput(), { target: { value: 'not-a-uuid' } });

    fireEvent.click(createButton());

    await waitFor(() => expect(screen.getByText(/Invalid uuid/i)).toBeInTheDocument());
    expect(mockedBulkChapters).not.toHaveBeenCalled();
    expect(mockedToastSuccess).not.toHaveBeenCalled();
    expect(mockedToastError).not.toHaveBeenCalled();
  });
});
