export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

export const METADATA_KEY = {
  USER_ID: 'userId',
  ORDER_TYPE: 'orderType',
  PACKAGE_ID: 'packageId',
  PLAN_ID: 'planId',
} as const;

export type CheckoutSessionMetadata = {
  userId: string;
  orderType: 'COIN_PURCHASE' | 'SUBSCRIPTION';
  packageId?: string;
  planId?: string;
};
