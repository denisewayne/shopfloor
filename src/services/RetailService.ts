/**
 * Retail Service: end-of-day close-out for a local shop. Pulls the day's
 * cash sales, totals them by payment method, and compares against the
 * cash drawer count.
 */
import { BaseService } from './BaseService';
import { BusinessProfile, getProfile } from '../profiles';
import { DailySummary, SaleLine, summarizeDay } from '../domain/retail';
import { runSearch } from '../utils/search';
import { SearchResultRow } from '../types';
import { Logger } from '../utils/logger';

export class RetailService extends BaseService {
  private readonly profile: BusinessProfile;

  constructor(profile: BusinessProfile = getProfile('retail')) {
    super('RetailService');
    this.profile = profile;
  }

  /** Load cash sale lines for a date (NetSuite date string, e.g. 11/18/2026). */
  loadSales(date: string): { lines: SaleLine[]; transactions: number } {
    return this.execute('loadSales', () => {
      const rows = runSearch(
        'cashsale',
        [
          { name: 'trandate', operator: 'on', values: date },
          { name: 'mainline', operator: 'is', values: 'F' },
          { name: 'taxline', operator: 'is', values: 'F' },
        ],
        [
          { name: 'item', label: 'item' },
          { name: 'quantity', label: 'quantity' },
          { name: 'amount', label: 'amount' },
          { name: 'paymentmethod', label: 'payment' },
        ]
      );
      const lines = rows.map(rowToSaleLine);
      const transactions = new Set(rows.map((r) => r.id)).size;
      return { lines, transactions };
    });
  }

  closeDay(date: string, countedCash: number | null): DailySummary {
    return this.execute('closeDay', () => {
      const { lines, transactions } = this.loadSales(date);
      const summary = summarizeDay(date, lines, transactions, countedCash, this.profile);
      if (summary.cash.flagged) {
        Logger.emergency('Cash drawer variance', { date, variance: summary.cash.variance });
      }
      return summary;
    });
  }
}

function field(v: SearchResultRow['values'][string] | undefined): { value: string; text: string } {
  if (v === undefined) return { value: '', text: '' };
  return typeof v === 'string' ? { value: v, text: v } : { value: v.value, text: v.text || v.value };
}

export function rowToSaleLine(row: SearchResultRow): SaleLine {
  const item = field(row.values['item']);
  return {
    itemId: item.value,
    itemName: item.text,
    quantity: Number(field(row.values['quantity']).value) || 0,
    amount: Number(field(row.values['amount']).value) || 0,
    paymentMethod: field(row.values['payment']).text || 'other',
  };
}
