import { planBuildQuantity, explodeBom, findShortages } from '../production';
import { getProfile } from '../../profiles/index';

const mfg = getProfile('manufacturing'); // batch 10, min 10, scrap 3%

describe('planBuildQuantity', () => {
  it('returns 0 when stock covers demand', () => {
    expect(planBuildQuantity(20, 25, mfg)).toBe(0);
  });

  it('pads for scrap and rounds to the batch size', () => {
    // net 95 / 0.97 = 97.9 -> 100
    expect(planBuildQuantity(100, 5, mfg)).toBe(100);
    // net 98 / 0.97 = 101.03 -> 110
    expect(planBuildQuantity(100, 2, mfg)).toBe(110);
  });

  it('respects the minimum batch', () => {
    expect(planBuildQuantity(1, 0, mfg)).toBe(10);
  });
});

describe('BOM explosion and shortages', () => {
  const plan = explodeBom('A1', 20, [
    { itemId: 'screw', quantityPer: 4 },
    { itemId: 'panel', quantityPer: 0.5 },
  ]);

  it('multiplies component quantities', () => {
    expect(plan.components).toEqual([
      { itemId: 'screw', required: 80 },
      { itemId: 'panel', required: 10 },
    ]);
  });

  it('reports only short components', () => {
    const short = findShortages(plan, { screw: 100, panel: 4 });
    expect(short).toEqual([{ itemId: 'panel', required: 10, available: 4, short: 6 }]);
  });
});
