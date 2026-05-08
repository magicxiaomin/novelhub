/**
 * Workers stub for FbCapiService. Task 3.1 wires only the consent-gated
 * surfaces AuthService consumes (`sendEvent`); the rest of the FB CAPI
 * module ports in a later task.
 *
 * AuthService only ever calls `fbCapi.sendEvent(...)` when the upstream
 * route resolved consent to `true`. The Hono routes in 3.1 don't yet read
 * the consent cookie, so this client is effectively unused — kept as a
 * structural-shape stub so the AuthServiceDeps type checks.
 */
import type { FbCustomData, FbUserData } from '../../modules/fb-capi/fb-capi.types';

export class FbCapiClient {
  async sendEvent(
    eventName: string,
    eventId: string,
    userData: FbUserData,
    customData?: FbCustomData,
    userId?: string,
  ): Promise<void> {
    // No-op for Task 3.1. Task 10 (CAPI async-hash + Sentry) ports the real
    // implementation including event ledger writes via Prisma.
    void eventName;
    void eventId;
    void userData;
    void customData;
    void userId;
  }
}
