export type ProductMode = 'mixed' | 'novels';

const DEFAULT_PRODUCT_MODE: ProductMode = 'mixed';

type ProductModeEnv = {
  PRODUCT_MODE?: string;
};

export function getProductMode(value?: string): ProductMode {
  return value === 'novels' ? 'novels' : DEFAULT_PRODUCT_MODE;
}

export function getWorkerProductMode(env?: ProductModeEnv): ProductMode {
  return getProductMode(env?.PRODUCT_MODE);
}

export function isNovelsOnlyProductMode(value?: string): boolean {
  return getProductMode(value) === 'novels';
}

export function isWorkerNovelsOnlyProductMode(env?: ProductModeEnv): boolean {
  return getWorkerProductMode(env) === 'novels';
}
