import { suggestReorder, groupByVendor, roundUpTo, StockSnapshot } from '../inventory';
import { getProfile } from '../../profiles/index';

const general = getProfile('general'); // lead 7, safety 14, multiple 1
const mfg = getProfile('manufacturing'); // lead 14, safety 21, multiple 10

const base: StockSnapshot = { itemId: '1', name: 'Widget', available: 0, onOrder: 0, dailyDemand: 0, vendorId: '77' };

describe('roundUpTo', () => {
  it('rounds up to multiples and ignores float noise', () => {
    expect(roundUpTo(1, 10)).toBe(10);
    expect(roundUpTo(10, 10)).toBe(10);
    expect(roundUpTo(11, 10)).toBe(20);
    expect(roundUpTo(0.1 + 0.2, 1)).toBe(1);
    expect(roundUpTo(100.00000000000001, 10)).toBe(100);
  });
});

describe('suggestReorder', () => {
  it('uses the explicit reorder point and preferred level', () => {
    const s = suggestReorder({ ...base, available: 3, onOrder: 2, reorderPoint: 5, preferredStockLevel: 20 }, general);
    expect(s?.quantity).toBe(15);
  });

  it('returns null when stock position is above the reorder point', () => {
    expect(suggestReorder({ ...base, available: 6, reorderPoint: 5 }, general)).toBeNull();
  });

  it('counts open purchase orders toward the position', () => {
    expect(suggestReorder({ ...base, available: 1, onOrder: 10, reorderPoint: 5 }, general)).toBeNull();
  });

  it('derives reorder point from demand when none is set', () => {
    // demand 2/day, lead 7 + safety 14 => ROP 42, target 42 + 14 = 56
    const s = suggestReorder({ ...base, available: 40, dailyDemand: 2 }, general);
    expect(s?.quantity).toBe(16);
  });

  it('rounds to the manufacturing pack size', () => {
    // demand 1/day, lead 14 + safety 21 => ROP 35, target 49, position 30 => 19 -> 20
    const s = suggestReorder({ ...base, available: 30, dailyDemand: 1 }, mfg);
    expect(s?.quantity).toBe(20);
  });

  it('does nothing for items with no demand and no reorder point', () => {
    expect(suggestReorder({ ...base, available: 0, dailyDemand: 0 }, general)).toBeNull();
  });
});

describe('groupByVendor', () => {
  it('groups by vendor and buckets missing vendors', () => {
    const g = groupByVendor([
      { itemId: '1', name: 'a', vendorId: 'v1', quantity: 1, reason: '' },
      { itemId: '2', name: 'b', vendorId: 'v1', quantity: 1, reason: '' },
      { itemId: '3', name: 'c', quantity: 1, reason: '' },
    ]);
    expect(g['v1']).toHaveLength(2);
    expect(g['unassigned']).toHaveLength(1);
  });
});
