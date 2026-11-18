/**
 * Platform-neutral error types. Adapters (NetSuite, CSV, other ERPs) map their
 * own failures onto these so callers can branch on `code` without knowing
 * which back end they are talking to.
 */
export class ShopfloorError extends Error {
  public readonly code: string;
  public readonly details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.name = 'ShopfloorError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ShopfloorError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class NotFoundError extends ShopfloorError {
  constructor(entity: string, id: string | number) {
    super('RECORD_NOT_FOUND', `${entity} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}
