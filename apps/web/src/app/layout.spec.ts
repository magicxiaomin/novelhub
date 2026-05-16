import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: 'font-body' }),
}));

describe('root metadata', () => {
  it('uses a safe local metadataBase so relative social images resolve absolutely', async () => {
    const { metadata } = await import('./layout');

    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
  });
});
