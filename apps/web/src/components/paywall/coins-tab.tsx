'use client';

import { COIN_PACKAGES, type CoinPackageId } from '@novelhub/shared';

import { cn } from '@/lib/utils';

export function CoinsTab({
  selectedPackage,
  onSelectPackage,
}: {
  selectedPackage: CoinPackageId;
  onSelectPackage: (packageId: CoinPackageId) => void;
}): JSX.Element {
  const packages = [
    COIN_PACKAGES.pack_50,
    COIN_PACKAGES.pack_120,
    COIN_PACKAGES.pack_260,
    COIN_PACKAGES.pack_700,
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {packages.map((pkg) => {
        const selected = selectedPackage === pkg.id;
        const bonus = pkg.label.match(/\(([^)]+)\)/)?.[1] ?? null;
        return (
          <button
            key={pkg.id}
            type="button"
            onClick={() => onSelectPackage(pkg.id)}
            className={cn(
              'relative min-h-28 rounded-lg border p-3 text-left transition-colors',
              selected ? 'border-brand bg-brand/10' : 'border-border bg-background',
            )}
          >
            {bonus ? (
              <span className="absolute right-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                {bonus}
              </span>
            ) : null}
            <p className="text-sm font-semibold">{pkg.label.replace(/\s*\([^)]+\)/, '')}</p>
            <p className="mt-4 text-xl font-bold">${pkg.priceUsd.toFixed(2)}</p>
          </button>
        );
      })}
    </div>
  );
}
