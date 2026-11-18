/**
 * Daily sales close-out for a local shop. Pure functions.
 */
import { BusinessProfile } from '../profiles/index';

export interface SaleLine {
  itemId: string;
  itemName: string;
  quantity: number;
  amount: number;
  /** e.g. 'cash', 'card', 'gift card'. */
  paymentMethod: string;
}

export interface DailySummary {
  date: string;
  transactions: number;
  grossSales: number;
  byPaymentMethod: Record<string, number>;
  topItems: Array<{ itemId: string; itemName: string; quantity: number; amount: number }>;
  cash: { expected: number; counted: number | null; variance: number | null; flagged: boolean };
}

export function summarizeDay(
  date: string,
  lines: SaleLine[],
  transactionCount: number,
  countedCash: number | null,
  profile: BusinessProfile
): DailySummary {
  const byPaymentMethod: Record<string, number> = {};
  const byItem: Record<string, { itemId: string; itemName: string; quantity: number; amount: number }> = {};
  let gross = 0;

  for (const l of lines) {
    gross += l.amount;
    const method = l.paymentMethod.toLowerCase();
    byPaymentMethod[method] = money((byPaymentMethod[method] ?? 0) + l.amount);
    const it = (byItem[l.itemId] ??= { itemId: l.itemId, itemName: l.itemName, quantity: 0, amount: 0 });
    it.quantity += l.quantity;
    it.amount = money(it.amount + l.amount);
  }

  const topItems = Object.values(byItem)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, profile.retail.topItemsCount);

  const expected = byPaymentMethod['cash'] ?? 0;
  const variance = countedCash === null ? null : money(countedCash - expected);
  const flagged = variance !== null && Math.abs(variance) > profile.retail.cashVarianceTolerance;

  return {
    date,
    transactions: transactionCount,
    grossSales: money(gross),
    byPaymentMethod,
    topItems,
    cash: { expected, counted: countedCash, variance, flagged },
  };
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}
