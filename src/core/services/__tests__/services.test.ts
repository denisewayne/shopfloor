/**
 * Core services against the in-memory backend. No NetSuite involved.
 */
import { InventoryService, ProductionService, RetailService } from '../index';
import { MemoryBackend } from '../../adapters/memory/index';
import { getProfile } from '../../profiles/index';
import { ValidationError } from '../../errors';

const stock = [
  { itemId: '1', name: 'Bolts', available: 2, onOrder: 0, dailyDemand: 0, reorderPoint: 5, preferredStockLevel: 50, vendorId: '10' },
  { itemId: '2', name: 'Nuts', available: 1, onOrder: 0, dailyDemand: 0, reorderPoint: 5, preferredStockLevel: 20, vendorId: '10' },
  { itemId: '3', name: 'Glue', available: 0, onOrder: 0, dailyDemand: 0, reorderPoint: 1, preferredStockLevel: 4 },
  { itemId: '4', name: 'Paint', available: 99, onOrder: 0, dailyDemand: 0, reorderPoint: 5 },
];

function inventory(): { svc: InventoryService; db: MemoryBackend } {
  const db = new MemoryBackend({ stock });
  return { db, svc: new InventoryService({ stock: db, purchaseOrders: db }, getProfile('general')) };
}

describe('InventoryService', () => {
  it('defaults to a dry run that writes nothing', () => {
    const { svc, db } = inventory();
    const r = svc.run();
    expect(r.dryRun).toBe(true);
    expect(r.suggestions.map((s) => s.itemId)).toEqual(['1', '2', '3']);
    expect(r.skippedNoVendor.map((s) => s.name)).toEqual(['Glue']);
    expect(db.purchaseOrders).toHaveLength(0);
  });

  it('creates one PO per vendor when dryRun is false', () => {
    const { svc, db } = inventory();
    const r = svc.run({ dryRun: false, locationId: '7' });
    expect(r.purchaseOrders).toEqual([{ vendorId: '10', id: 'PO-1', lines: 2 }]);
    expect(db.purchaseOrders[0]).toMatchObject({
      vendorId: '10',
      locationId: '7',
      lines: [{ itemId: '1', quantity: 48 }, { itemId: '2', quantity: 19 }],
    });
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
    const db = new MemoryBackend();
    const r = new ProductionService({ workOrders: db }, getProfile('manufacturing')).scheduleBuild(req);
    expect(r).toMatchObject({ buildQuantity: 30, workOrderId: 'WO-1' });
    expect(r.shortages).toEqual([{ itemId: 'c1', required: 60, available: 10, short: 50 }]);
    expect(db.workOrders[0]).toMatchObject({ assemblyId: '500', quantity: 30 });
  });

  it('can block on shortages', () => {
    const svc = new ProductionService({ workOrders: new MemoryBackend() }, getProfile('manufacturing'));
    expect(() => svc.scheduleBuild(req, { blockOnShortage: true })).toThrow(/short on c1/);
  });

  it('dry run creates nothing', () => {
    const db = new MemoryBackend();
    new ProductionService({ workOrders: db }, getProfile('manufacturing')).scheduleBuild(req, { dryRun: true });
    expect(db.workOrders).toHaveLength(0);
  });

  it('refuses to run on a profile without production', () => {
    const svc = new ProductionService({ workOrders: new MemoryBackend() }, getProfile('retail'));
    expect(() => svc.scheduleBuild(req)).toThrow(ValidationError);
  });
});

describe('RetailService', () => {
  it('closes the day and flags a short drawer', () => {
    const db = new MemoryBackend({
      sales: [
        { date: 'd1', transactionId: 't1', itemId: '7', itemName: 'Coffee', quantity: 2, amount: 10, paymentMethod: 'Cash' },
        { date: 'd1', transactionId: 't1', itemId: '8', itemName: 'Bagel', quantity: 1, amount: 5, paymentMethod: 'Cash' },
        { date: 'd1', transactionId: 't2', itemId: '7', itemName: 'Coffee', quantity: 1, amount: 5, paymentMethod: 'Visa' },
        { date: 'd2', transactionId: 't3', itemId: '7', itemName: 'Coffee', quantity: 1, amount: 5, paymentMethod: 'Cash' },
      ],
    });
    const errors: string[] = [];
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: (t: string) => errors.push(t) };

    const s = new RetailService({ sales: db, logger }, getProfile('retail')).closeDay('d1', 10);
    expect(s.transactions).toBe(2);
    expect(s.grossSales).toBe(20);
    expect(s.byPaymentMethod).toEqual({ cash: 15, visa: 5 });
    expect(s.cash).toMatchObject({ expected: 15, variance: -5, flagged: true });
    expect(errors).toEqual(['Cash drawer variance']);
  });
});
