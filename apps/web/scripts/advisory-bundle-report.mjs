#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const nextRoot = join(webRoot, '.next');
const outputPath = join(webRoot, 'reports', 'advisory-bundle-size.md');
const routes = ['/', '/novels', '/book/[id]', '/me'];

function readJsonIfExists(path) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

function routeCandidates(route) {
  if (route === '/') return ['/', '/page'];
  return [route, `${route}/page`];
}

function assetsForRoute(manifest, route) {
  for (const candidate of routeCandidates(route)) {
    const assets = manifest.pages?.[candidate] ?? manifest.app?.[candidate];
    if (assets) return assets;
  }
  return [];
}

function assetSize(asset) {
  const absolute = join(nextRoot, asset);
  if (!existsSync(absolute)) return 0;
  return statSync(absolute).size;
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function buildReport({ manifest, generatedAt }) {
  const rows = routes.map((route) => {
    const assets = assetsForRoute(manifest, route);
    const totalBytes = assets.reduce((sum, asset) => sum + assetSize(asset), 0);
    return `| ${route} | ${assets.length} | ${formatKiB(totalBytes)} |`;
  });

  return [
    '# Advisory bundle-size report',
    '',
    `Generated: ${generatedAt}`,
    '',
    'Advisory only: this report records bundle output and does not enforce CI thresholds.',
    '',
    '| Route | JS assets | Total size |',
    '| --- | ---: | ---: |',
    ...rows,
    '',
    'Source: local Next.js build manifests under apps/web/.next/. Run after pnpm --filter @novelhub/web build or pnpm --filter @novelhub/web pages:build.',
    'Rollback: revert the PR that added this advisory report/test bundle.',
    '',
  ].join('\n');
}

const buildManifest = readJsonIfExists(join(nextRoot, 'build-manifest.json'));
const appManifest = readJsonIfExists(join(nextRoot, 'app-build-manifest.json'));
const manifest = {
  pages: buildManifest.pages ?? {},
  app: appManifest.pages ?? appManifest.app ?? {},
};

mkdirSync(dirname(outputPath), { recursive: true });
const report = buildReport({ manifest, generatedAt: new Date().toISOString() });
writeFileSync(outputPath, report);
process.stdout.write(`${report}\nWrote ${outputPath}\n`);
