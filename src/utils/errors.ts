/**
 * Custom error classes for NetSuite integrations.
 *
 * Each error carries a machine-readable `code` so RESTlet responses,
 * Map/Reduce summarize steps, and monitoring can classify failures
 * without parsing message strings.
 */

export class NetSuiteError extends Error {
  public readonly code: string;
  public readonly details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.name = 'NetSuiteError';
    this.code = code;
    this.details = details;
  }
}

export class RecordNotFoundError extends NetSuiteError {
  constructor(recordType: string, id: string | number) {
    super('RECORD_NOT_FOUND', `${recordType} with id ${id} not found`);
    this.name = 'RecordNotFoundError';
  }
}

export class ValidationError extends NetSuiteError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
    this.field = field;
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
