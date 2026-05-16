import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const publicDir = path.join(__dirname, '..', 'public');

type ManifestIcon = {
  src?: string;
  sizes?: string;
  type?: string;
  purpose?: string;
};

type WebManifest = {
  start_url?: string;
  display?: string;
  icons?: ManifestIcon[];
};

async function readManifest(): Promise<WebManifest> {
  const manifest = await readFile(path.join(publicDir, 'manifest.json'), 'utf8');
  return JSON.parse(manifest) as WebManifest;
}

async function readPngSize(src: string): Promise<{ width: number; height: number }> {
  const filePath = path.join(publicDir, src.replace(/^\//, ''));
  const png = await readFile(filePath);

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe('PWA manifest assets', () => {
  it('keeps NovelHub installable with a standalone display mode and root start URL', async () => {
    const manifest = await readManifest();

    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
  });

  it('declares reachable PNG icons at 192px and 512px', async () => {
    const manifest = await readManifest();
    const icons = manifest.icons ?? [];

    for (const size of ['192x192', '512x512']) {
      const icon = icons.find(
        (candidate) => candidate.sizes === size && candidate.type === 'image/png',
      );

      expect(icon, `missing ${size} PNG icon`).toBeDefined();
      expect(icon?.src).toBeTruthy();

      const [expectedWidth, expectedHeight] = size.split('x').map(Number);
      const actualSize = await readPngSize(icon?.src ?? '');
      expect(actualSize).toEqual({ width: expectedWidth, height: expectedHeight });
    }
  });

  it('retains a maskable 512px icon for install prompt quality', async () => {
    const manifest = await readManifest();
    const maskableIcon = (manifest.icons ?? []).find(
      (icon) => icon.sizes === '512x512' && icon.purpose?.split(/\s+/).includes('maskable'),
    );

    expect(maskableIcon, 'missing 512x512 maskable icon').toBeDefined();
    const actualSize = await readPngSize(maskableIcon?.src ?? '');
    expect(actualSize).toEqual({ width: 512, height: 512 });
  });
});
