import { summarizeDay, SaleLine } from '../retail';
import { getProfile } from '../../profiles';

const retail = getProfile('retail'); // tolerance 2, top 10

const lines: SaleLine[] = [
  { itemId: '1', itemName: 'Coffee', quantity: 3, amount: 9, paymentMethod: 'Cash' },
  { itemId: '2', itemName: 'Muffin', quantity: 2, amount: 7.5, paymentMethod: 'Card' },
  { itemId: '1', itemName: 'Coffee', quantity: 1, amount: 3, paymentMethod: 'cash' },
];

describe('summarizeDay', () => {
  it('totals sales by payment method (case-insensitive)', () => {
    const s = summarizeDay('11/18/2026', lines, 3, null, retail);
    expect(s.grossSales).toBe(19.5);
    expect(s.byPaymentMethod).toEqual({ cash: 12, card: 7.5 });
    expect(s.topItems[0]).toMatchObject({ itemName: 'Coffee', quantity: 4, amount: 12 });
  });

  it('does not flag a drawer within tolerance', () => {
    const s = summarizeDay('d', lines, 3, 13.5, retail);
    expect(s.cash.variance).toBe(1.5);
    expect(s.cash.flagged).toBe(false);
  });

  it('flags a short drawer beyond tolerance', () => {
    const s = summarizeDay('d', lines, 3, 9, retail);
    expect(s.cash.variance).toBe(-3);
    expect(s.cash.flagged).toBe(true);
  });

  it('leaves variance null when the drawer was not counted', () => {
    expect(summarizeDay('d', [], 0, null, retail).cash).toEqual({ expected: 0, counted: null, variance: null, flagged: false });
  });
});
