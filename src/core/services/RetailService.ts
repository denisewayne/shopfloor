/**
 * End-of-day close-out for a shop: totals sales by payment method and
 * checks the cash drawer. Back-end agnostic.
 */
import { BusinessProfile, getProfile } from '../profiles/index';
import { DailySummary, summarizeDay } from '../domain/retail';
import { Logger, SalesSource, silentLogger } from '../ports/index';

export interface RetailDeps {
  sales: SalesSource;
  logger?: Logger;
}

export class RetailService {
  private readonly log: Logger;

  constructor(
    private readonly deps: RetailDeps,
    private readonly profile: BusinessProfile = getProfile('retail')
  ) {
    this.log = deps.logger ?? silentLogger;
  }

  closeDay(date: string, countedCash: number | null): DailySummary {
    const { lines, transactions } = this.deps.sales.listSales(date);
    const summary = summarizeDay(date, lines, transactions, countedCash, this.profile);
    if (summary.cash.flagged) {
      this.log.error('Cash drawer variance', { date, variance: summary.cash.variance });
    }
    return summary;
  }
}
