export type ProductMode = 'mixed' | 'novels';

const DEFAULT_PRODUCT_MODE: ProductMode = 'mixed';

type ProductModeEnv = {
  process?: {
    env?: {
      PRODUCT_MODE?: string;
    };
  };
};

function readRuntimeProductMode(): string | undefined {
  return (globalThis as ProductModeEnv).process?.env?.PRODUCT_MODE;
}

export function getProductMode(value = readRuntimeProductMode()): ProductMode {
  return value === 'novels' ? 'novels' : DEFAULT_PRODUCT_MODE;
}

export function isNovelsOnlyProductMode(value = readRuntimeProductMode()): boolean {
  return getProductMode(value) === 'novels';
}
