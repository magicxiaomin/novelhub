/**
 * Marker error for the coin spend path. Caught by callers that want to map
 * the failure to an HTTP 402 with a paywall envelope; otherwise propagates.
 */
export class InsufficientBalanceError extends Error {
  constructor(
    public readonly required: number,
    public readonly current: number,
  ) {
    super(`Insufficient coin balance: need ${required}, have ${current}`);
    this.name = 'InsufficientBalanceError';
  }
}
