/**
 * NetSuite adapter: config-driven searches and record writes, via N/* mocks.
 */
import { NetSuiteBackend, rowToSaleLine, rowToSnapshot } from '../index';
import { makeNetSuiteConfig, defaultNetSuiteConfig } from '../config';
import { InventoryService } from '../../../core/services/index';
import { getProfile } from '../../../core/profiles/index';
import { ValidationError } from '../../../core/errors';
import { ValidationError as NsValidationError, ShopfloorError } from '../../utils/errors';
import { _setMockResults } from '../../../../test/__mocks__/N/search';
import { _clearLogs } from '../../../../test/__mocks__/N/log';

beforeEach(() => {
  _clearLogs();
  _setMockResults([]);
});

function mockRow(id: string, cells: Record<string, string>, texts: Record<string, string> = {}): unknown {
  return {
    id,
    recordType: 'x',
    getValue: (c: { label?: string }) => cells[c.label ?? ''] ?? '',
    getText: (c: { label?: string }) => texts[c.label ?? ''] ?? '',
  };
}

describe('config', () => {
  it('merges overrides without losing defaults', () => {
    const c = makeNetSuiteConfig({ inventory: { columns: { leadtime: 'custitem_lead_days' } }, sales: { recordType: 'invoice' } });
    expect(c.inventory.columns.leadtime).toBe('custitem_lead_days');
    expect(c.inventory.columns.available).toBe('quantityavailable');
    expect(c.sales.recordType).toBe('invoice');
    expect(c.sales.columns.payment).toBe('paymentmethod');
    expect(defaultNetSuiteConfig.inventory.columns.leadtime).toBe('leadtime');
  });

  it('keeps script parameter ids within the NetSuite length limit', () => {
    for (const id of Object.values(defaultNetSuiteConfig.params)) {
      expect(id.startsWith('custscript_')).toBe(true);
      expect(id.length).toBeLessThanOrEqual(30);
    }
  });
});

describe('NetSuiteBackend', () => {
  it('reads stock rows through the configured columns', () => {
    _setMockResults([mockRow('9', { name: 'Tape', available: '4', onorder: '', reorderpoint: '6', vendor: '33' }, { name: 'Tape' })] as never);
    expect(new NetSuiteBackend().listStock()).toEqual([
      expect.objectContaining({ itemId: '9', name: 'Tape', available: 4, onOrder: 0, reorderPoint: 6, vendorId: '33' }),
    ]);
  });

  it('drives the core InventoryService end to end', () => {
    _setMockResults([mockRow('9', { available: '1', reorderpoint: '5', preferred: '10', vendor: '33' })] as never);
    const ns = new NetSuiteBackend();
    const r = new InventoryService({ stock: ns, purchaseOrders: ns }, getProfile('general')).run({ dryRun: false });
    expect(r.purchaseOrders).toEqual([{ vendorId: '33', id: expect.any(String), lines: 1 }]);
  });

  it('creates work orders and validates input', () => {
    const ns = new NetSuiteBackend();
    expect(ns.createWorkOrder({ assemblyId: '5', quantity: 10, sourceId: '77' })).toMatch(/^\d+$/);
    expect(() => ns.createWorkOrder({ assemblyId: '5', quantity: 0 })).toThrow(ValidationError);
    expect(() => ns.createPurchaseOrder({ vendorId: '1', lines: [] })).toThrow(ValidationError);
  });

  it('counts distinct transactions in sales', () => {
    _setMockResults([
      mockRow('1', { item: '7', quantity: '2', amount: '10', payment: '1' }, { item: 'Coffee', payment: 'Cash' }),
      mockRow('1', { item: '8', quantity: '1', amount: '5', payment: '1' }, { item: 'Bagel', payment: 'Cash' }),
      mockRow('2', { item: '7', quantity: '1', amount: '5', payment: '2' }, { item: 'Coffee', payment: 'Visa' }),
    ] as never);
    const { lines, transactions } = new NetSuiteBackend().listSales('11/18/2026');
    expect(transactions).toBe(2);
    expect(lines[0]).toEqual({ itemId: '7', itemName: 'Coffee', quantity: 2, amount: 10, paymentMethod: 'Cash' });
  });
});

describe('row mappers', () => {
  it('handle plain strings and blanks', () => {
    expect(rowToSnapshot({ id: '1', recordType: 'x', values: { available: '' } }).available).toBe(0);
    expect(rowToSaleLine({ id: '1', recordType: 'x', values: { item: '3', amount: '2.5', quantity: '1' } })).toEqual({
      itemId: '3', itemName: '3', quantity: 1, amount: 2.5, paymentMethod: 'other',
    });
  });
});

describe('errors', () => {
  it('NetSuite and core share one ValidationError class', () => {
    expect(NsValidationError).toBe(ValidationError);
    expect(new ValidationError('x')).toBeInstanceOf(ShopfloorError);
  });
});
