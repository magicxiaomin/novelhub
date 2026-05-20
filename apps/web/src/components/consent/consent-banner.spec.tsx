/* @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentCategories } from '@novelhub/shared';

import { messages } from '@novelhub/shared';
import { initPixel, readTrackingConsent, setTrackingConsent } from '@/lib/fb-pixel';

vi.mock('@/lib/fb-pixel', () => ({
  initPixel: vi.fn(),
  readTrackingConsent: vi.fn(),
  setTrackingConsent: vi.fn(),
}));

const mockedInitPixel = vi.mocked(initPixel);
const mockedReadTrackingConsent = vi.mocked(readTrackingConsent);
const mockedSetTrackingConsent = vi.mocked(setTrackingConsent);

let originalCookieDescriptor: PropertyDescriptor | undefined;
let cookieWrites: string[];

async function renderBanner(): Promise<void> {
  const { ConsentBanner } = await import('./consent-banner');

  render(<ConsentBanner />);
}

function consentSwitch(label: string): HTMLButtonElement {
  const row = screen.getByText(label).closest('label');
  const switchButton = row?.querySelector('button[role="switch"]');

  if (!(switchButton instanceof HTMLButtonElement)) {
    throw new Error(`Unable to find switch: ${label}`);
  }

  return switchButton;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  cookieWrites = [];
  originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => '',
    set: (value: string) => {
      cookieWrites.push(value);
    },
  });
  mockedReadTrackingConsent.mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalCookieDescriptor) {
    Object.defineProperty(document, 'cookie', originalCookieDescriptor);
  } else {
    Reflect.deleteProperty(document, 'cookie');
  }
  Reflect.deleteProperty(globalThis, 'React');
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});

describe('ConsentBanner', () => {
  it('hides when consent already exists and does not initialize pixel or cookies', async () => {
    mockedReadTrackingConsent.mockReturnValue({ analytics: true, marketing: false });

    await renderBanner();

    expect(screen.queryByText(messages.consent.body)).not.toBeInTheDocument();
    expect(mockedInitPixel).not.toHaveBeenCalled();
    expect(mockedSetTrackingConsent).not.toHaveBeenCalled();
    expect(cookieWrites).toEqual([]);
  });

  it('accepts all tracking, hides the banner, initializes Pixel, and dispatches consent changed', async () => {
    const changed = vi.fn();
    window.addEventListener('tracking-consent-changed', changed);

    await renderBanner();
    await screen.findByText(messages.consent.body);
    fireEvent.click(screen.getByRole('button', { name: messages.consent.accept }));

    expect(mockedSetTrackingConsent).toHaveBeenCalledWith({ analytics: true, marketing: true });
    expect(mockedInitPixel).toHaveBeenCalledTimes(1);
    expect(cookieWrites).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText(messages.consent.body)).not.toBeInTheDocument());

    window.removeEventListener('tracking-consent-changed', changed);
  });

  it('rejects all tracking, hides the banner, clears fb cookies, and dispatches consent changed', async () => {
    const changed = vi.fn();
    window.addEventListener('tracking-consent-changed', changed);

    await renderBanner();
    await screen.findByText(messages.consent.body);
    fireEvent.click(screen.getByRole('button', { name: messages.consent.reject }));

    expect(mockedSetTrackingConsent).toHaveBeenCalledWith({ analytics: false, marketing: false });
    expect(mockedInitPixel).not.toHaveBeenCalled();
    expect(cookieWrites).toEqual([
      '_fbc=; path=/; max-age=0; SameSite=Lax',
      '_fbp=; path=/; max-age=0; SameSite=Lax',
    ]);
    expect(changed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText(messages.consent.body)).not.toBeInTheDocument());

    window.removeEventListener('tracking-consent-changed', changed);
  });

  it('opens customize from existing preferences, saves selected categories, and dispatches consent changed', async () => {
    const changed = vi.fn();
    window.addEventListener('tracking-consent-changed', changed);
    mockedReadTrackingConsent
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ analytics: true, marketing: false });

    await renderBanner();
    await screen.findByText(messages.consent.body);
    fireEvent.click(screen.getByRole('button', { name: messages.consent.customize }));

    expect(await screen.findByText(messages.consent.customizeTitle)).toBeInTheDocument();
    expect(consentSwitch(messages.consent.analytics)).toHaveAttribute('aria-checked', 'true');
    expect(consentSwitch(messages.consent.marketing)).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(consentSwitch(messages.consent.marketing));
    fireEvent.click(screen.getByRole('button', { name: messages.consent.save }));

    expect(mockedSetTrackingConsent).toHaveBeenCalledWith({ analytics: true, marketing: true });
    expect(mockedInitPixel).toHaveBeenCalledTimes(1);
    expect(cookieWrites).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText(messages.consent.body)).not.toBeInTheDocument());

    window.removeEventListener('tracking-consent-changed', changed);
  });

  it('customize save clears fb cookies when marketing stays disabled', async () => {
    const preference: ConsentCategories = { analytics: true, marketing: false };
    mockedReadTrackingConsent.mockReturnValueOnce(null).mockReturnValueOnce(preference);

    await renderBanner();
    await screen.findByText(messages.consent.body);
    fireEvent.click(screen.getByRole('button', { name: messages.consent.customize }));
    fireEvent.click(await screen.findByRole('button', { name: messages.consent.save }));

    expect(mockedSetTrackingConsent).toHaveBeenCalledWith(preference);
    expect(mockedInitPixel).not.toHaveBeenCalled();
    expect(cookieWrites).toEqual([
      '_fbc=; path=/; max-age=0; SameSite=Lax',
      '_fbp=; path=/; max-age=0; SameSite=Lax',
    ]);
    await waitFor(() => expect(screen.queryByText(messages.consent.body)).not.toBeInTheDocument());
  });
});
