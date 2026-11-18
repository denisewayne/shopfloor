/**
 * Service-level tests for the small business modules, using the N/* mocks.
 */
import { InventoryService, rowToSnapshot } from '../InventoryService';
import { ProductionService } from '../ProductionService';
import { RetailService, rowToSaleLine } from '../RetailService';
import { SalesOrderService } from '../SalesOrderService';
import { getProfile } from '../../profiles';
import { ValidationError } from '../../utils/errors';
import { _setMockResults } from '../../../test/__mocks__/N/search';
import { _clearLogs } from '../../../test/__mocks__/N/log';

beforeEach(() => {
  _clearLogs();
  _setMockResults([]);
});

describe('InventoryService', () => {
  const stock = [
    { itemId: '1', name: 'Bolts', available: 2, onOrder: 0, dailyDemand: 0, reorderPoint: 5, preferredStockLevel: 50, vendorId: '10' },
    { itemId: '2', name: 'Nuts', available: 1, onOrder: 0, dailyDemand: 0, reorderPoint: 5, preferredStockLevel: 20, vendorId: '10' },
    { itemId: '3', name: 'Glue', available: 0, onOrder: 0, dailyDemand: 0, reorderPoint: 1, preferredStockLevel: 4 },
    { itemId: '4', name: 'Paint', available: 99, onOrder: 0, dailyDemand: 0, reorderPoint: 5 },
  ];

  it('dry run plans but creates no purchase orders', () => {
    const r = new InventoryService(getProfile('general')).run(stock, true);
    expect(r.suggestions.map((s) => s.itemId)).toEqual(['1', '2', '3']);
    expect(r.purchaseOrders).toHaveLength(0);
    expect(r.skippedNoVendor.map((s) => s.name)).toEqual(['Glue']);
  });

  it('creates one PO per vendor when not a dry run', () => {
    const r = new InventoryService(getProfile('general')).run(stock, false);
    expect(r.purchaseOrders).toHaveLength(1);
    expect(r.purchaseOrders[0]).toMatchObject({ vendorId: '10', lines: 2 });
  });

  it('maps search rows, treating blanks as unset', () => {
    const snap = rowToSnapshot({
      id: '9',
      recordType: 'inventoryitem',
      values: { name: 'Tape', available: '4', onorder: '', reorderpoint: '6', vendor: { value: '33', text: 'ACME' } },
    });
    expect(snap).toMatchObject({ itemId: '9', name: 'Tape', available: 4, onOrder: 0, reorderPoint: 6, vendorId: '33' });
    expect(snap.preferredStockLevel).toBeUndefined();
  });
});

describe('ProductionService', () => {
  const req = {
    assemblyId: '500',
    openDemand: 25,
    available: 0,
    bom: [{ itemId: 'c1', quantityPer: 2 }],
    componentStock: { c1: 10 },
  };

  it('creates a work order and reports shortages', () => {
    const r = new ProductionService(getProfile('manufacturing')).scheduleBuild(req);
    expect(r.buildQuantity).toBe(30);
    expect(r.workOrderId).toEqual(expect.any(Number));
    expect(r.shortages).toEqual([{ itemId: 'c1', required: 60, available: 10, short: 50 }]);
  });

  it('can block on shortages', () => {
    expect(() =>
      new ProductionService(getProfile('manufacturing')).scheduleBuild(req, { blockOnShortage: true })
    ).toThrow(/short on c1/);
  });

  it('dry run creates nothing', () => {
    expect(new ProductionService(getProfile('manufacturing')).scheduleBuild(req, { dryRun: true }).workOrderId).toBeNull();
  });

  it('refuses to run on a profile without production', () => {
    expect(() => new ProductionService(getProfile('retail')).scheduleBuild(req)).toThrow(ValidationError);
  });
});

describe('RetailService', () => {
  it('closes the day from cash sale search results', () => {
    const mk = (id: string, item: string, qty: string, amt: string, pay: string) => ({
      id,
      recordType: 'cashsale',
      getValue: (c: { label?: string }) =>
        ({ item, quantity: qty, amount: amt, payment: pay } as Record<string, string>)[c.label ?? ''],
      getText: (c: { label?: string }) => (c.label === 'item' ? `Item ${item}` : c.label === 'payment' ? pay : ''),
    });
    _setMockResults([mk('1', '7', '2', '10', 'Cash'), mk('1', '8', '1', '5', 'Cash'), mk('2', '7', '1', '5', 'Visa')]);

    const s = new RetailService(getProfile('retail')).closeDay('11/18/2026', 10);
    expect(s.transactions).toBe(2);
    expect(s.grossSales).toBe(20);
    expect(s.byPaymentMethod).toEqual({ cash: 15, visa: 5 });
    expect(s.cash).toMatchObject({ expected: 15, variance: -5, flagged: true });
  });

  it('maps a search row with plain string values', () => {
    expect(rowToSaleLine({ id: '1', recordType: 'cashsale', values: { item: '3', amount: '2.5', quantity: '1' } })).toEqual({
      itemId: '3', itemName: '3', quantity: 1, amount: 2.5, paymentMethod: 'other',
    });
  });
});

describe('SalesOrderService with profiles', () => {
  it('enforces the manufacturing minimum order total', () => {
    const svc = new SalesOrderService(getProfile('manufacturing'));
    expect(() => svc.createOrder({ entity: 1, subsidiary: 1, items: [{ item: 1, quantity: 1, rate: 20 }] })).toThrow(/minimum of 50/);
    expect(svc.createOrder({ entity: 1, subsidiary: 1, items: [{ item: 1, quantity: 3, rate: 20 }] })).toEqual(expect.any(Number));
  });

  it('enforces the retail line cap', () => {
    const items = Array.from({ length: 201 }, (_, i) => ({ item: i + 1, quantity: 1, rate: 1 }));
    expect(() => new SalesOrderService(getProfile('retail')).createOrder({ entity: 1, subsidiary: 1, items })).toThrow(/200 line items/);
  });
});
