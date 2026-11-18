/**
 * Tests for constants and enums.
 */
import { RecordType, TransactionStatus, ExecutionContext, Fields, Sublists, Governance } from '../../constants';

describe('RecordType enum', () => {
  it('has the expected sales order value', () => {
    expect(RecordType.SALES_ORDER).toBe('salesorder');
  });

  it('has the expected customer value', () => {
    expect(RecordType.CUSTOMER).toBe('customer');
  });

  it('has the expected invoice value', () => {
    expect(RecordType.INVOICE).toBe('invoice');
  });
});

describe('TransactionStatus enum', () => {
  it('has pending fulfillment', () => {
    expect(TransactionStatus.PENDING_FULFILLMENT).toBe('pendingFulfillment');
  });

  it('has closed', () => {
    expect(TransactionStatus.CLOSED).toBe('closed');
  });
});

describe('ExecutionContext enum', () => {
  it('maps user interface', () => {
    expect(ExecutionContext.USER_INTERFACE).toBe('userinterface');
  });

  it('maps scheduled', () => {
    expect(ExecutionContext.SCHEDULED).toBe('scheduled');
  });
});

describe('Fields constants', () => {
  it('has common field IDs', () => {
    expect(Fields.INTERNAL_ID).toBe('internalid');
    expect(Fields.ENTITY).toBe('entity');
    expect(Fields.ITEM).toBe('item');
    expect(Fields.QUANTITY).toBe('quantity');
  });

  it('is typed as const (readonly at compile time)', () => {
    // `as const` is a compile-time assertion; verify the values are stable
    expect(Fields.INTERNAL_ID).toBeDefined();
    expect(typeof Fields.ENTITY).toBe('string');
  });
});

describe('Sublists constants', () => {
  it('has item sublist', () => {
    expect(Sublists.ITEM).toBe('item');
  });
});

describe('Governance constants', () => {
  it('has yield threshold', () => {
    expect(Governance.YIELD_THRESHOLD).toBe(100);
  });

  it('has search page size', () => {
    expect(Governance.SEARCH_PAGE_SIZE).toBe(1000);
  });
});
