export type BuildManifest = {
  pages?: Record<string, string[]>;
  app?: Record<string, string[]>;
};

export type AdvisoryBundleReportInput = {
  manifest: BuildManifest;
  fileSizes: Record<string, number>;
  routes: string[];
  generatedAt: string;
};

function formatKiB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function routeCandidates(route: string): string[] {
  if (route === '/') return ['/', '/page'];
  return [route, `${route}/page`];
}

function assetsForRoute(manifest: BuildManifest, route: string): string[] {
  for (const candidate of routeCandidates(route)) {
    const assets = manifest.pages?.[candidate] ?? manifest.app?.[candidate];
    if (assets) return assets;
  }
  return [];
}

export function buildAdvisoryBundleReport({
  manifest,
  fileSizes,
  routes,
  generatedAt,
}: AdvisoryBundleReportInput): string {
  const rows = routes.map((route) => {
    const assets = assetsForRoute(manifest, route);
    const totalBytes = assets.reduce((sum, asset) => sum + (fileSizes[asset] ?? 0), 0);
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
    'Rollback: revert the PR that added this advisory report/test bundle.',
    '',
  ].join('\n');
}
