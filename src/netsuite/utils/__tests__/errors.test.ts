/**
 * Tests for the error class hierarchy.
 */
import {
  NetSuiteError,
  RecordNotFoundError,
  ValidationError,
  GovernanceLimitError,
  IntegrationError,
  ConcurrencyError,
} from '../../utils/errors';

describe('NetSuiteError', () => {
  it('carries a code and message', () => {
    const err = new NetSuiteError('TEST_CODE', 'test message', 'extra details');
    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('test message');
    expect(err.details).toBe('extra details');
    expect(err.name).toBe('NetSuiteError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('RecordNotFoundError', () => {
  it('formats the message with record type and id', () => {
    const err = new RecordNotFoundError('salesorder', 12345);
    expect(err.code).toBe('RECORD_NOT_FOUND');
    expect(err.message).toContain('salesorder');
    expect(err.message).toContain('12345');
    expect(err.name).toBe('RecordNotFoundError');
  });
});

describe('ValidationError', () => {
  it('carries optional field reference', () => {
    const err = new ValidationError('Bad value', 'quantity');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.field).toBe('quantity');
    expect(err.message).toBe('Bad value');
  });

  it('works without a field', () => {
    const err = new ValidationError('Generic validation failure');
    expect(err.field).toBeUndefined();
  });
});

describe('GovernanceLimitError', () => {
  it('includes remaining units in the message', () => {
    const err = new GovernanceLimitError(50);
    expect(err.code).toBe('GOVERNANCE_LIMIT');
    expect(err.message).toContain('50');
  });
});

describe('IntegrationError', () => {
  it('carries HTTP status and response body', () => {
    const err = new IntegrationError('Bad gateway', 502, '{"error":"timeout"}');
    expect(err.code).toBe('INTEGRATION_ERROR');
    expect(err.statusCode).toBe(502);
    expect(err.responseBody).toBe('{"error":"timeout"}');
  });
});

describe('ConcurrencyError', () => {
  it('includes record type and id', () => {
    const err = new ConcurrencyError('salesorder', 999);
    expect(err.code).toBe('CONCURRENCY_ERROR');
    expect(err.message).toContain('salesorder:999');
  });
});
