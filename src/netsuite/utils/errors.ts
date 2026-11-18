/**
 * NetSuite error classes. They extend the platform-neutral core errors, so
 * a ValidationError thrown by a core service is the same class NetSuite
 * scripts catch, and every error still carries a machine-readable `code`.
 */
import { ShopfloorError, ValidationError, NotFoundError } from '../../core/errors';

export { ShopfloorError, ValidationError, NotFoundError };

export class NetSuiteError extends ShopfloorError {
  constructor(code: string, message: string, details?: string) {
    super(code, message, details);
    this.name = 'NetSuiteError';
  }
}

export class RecordNotFoundError extends NotFoundError {
  constructor(recordType: string, id: string | number) {
    super(recordType, id);
    this.name = 'RecordNotFoundError';
  }
}

export class GovernanceLimitError extends NetSuiteError {
  constructor(remaining: number) {
    super('GOVERNANCE_LIMIT', `Governance limit approaching: ${remaining} units remaining`);
    this.name = 'GovernanceLimitError';
  }
}

export class IntegrationError extends NetSuiteError {
  public readonly statusCode?: number;
  public readonly responseBody?: string;

  constructor(message: string, statusCode?: number, responseBody?: string) {
    super('INTEGRATION_ERROR', message);
    this.name = 'IntegrationError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class ConcurrencyError extends NetSuiteError {
  constructor(recordType: string, id: string | number) {
    super('CONCURRENCY_ERROR', `Record ${recordType}:${id} was modified by another process`);
    this.name = 'ConcurrencyError';
  }
}
