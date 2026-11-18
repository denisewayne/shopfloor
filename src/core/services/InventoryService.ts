/**
 * Reorder planning: finds items at or below their reorder point and
 * creates one purchase order per vendor. Back-end agnostic.
 */
import { BusinessProfile, getProfile } from '../profiles/index';
import { ReorderSuggestion, StockSnapshot, groupByVendor, suggestReorder } from '../domain/inventory';
import { Id, Logger, PurchaseOrderWriter, StockSource, silentLogger } from '../ports/index';

export interface ReorderRunResult {
  dryRun: boolean;
  suggestions: ReorderSuggestion[];
  purchaseOrders: Array<{ vendorId: Id; id: Id; lines: number }>;
  skippedNoVendor: ReorderSuggestion[];
}

export interface InventoryDeps {
  stock: StockSource;
  purchaseOrders: PurchaseOrderWriter;
  logger?: Logger;
}

export class InventoryService {
  private readonly log: Logger;

  constructor(
    private readonly deps: InventoryDeps,
    private readonly profile: BusinessProfile = getProfile()
  ) {
    this.log = deps.logger ?? silentLogger;
  }

  /** Pure planning step over a stock list. */
  plan(stock: StockSnapshot[] = this.deps.stock.listStock()): ReorderSuggestion[] {
    return stock
      .map((s) => suggestReorder(s, this.profile))
      .filter((s): s is ReorderSuggestion => s !== null);
  }

  /** Plan and, unless dryRun, create one purchase order per vendor. Dry run is the default. */
  run(opts: { dryRun?: boolean; locationId?: Id; stock?: StockSnapshot[] } = {}): ReorderRunResult {
    const dryRun = opts.dryRun ?? true;
    const suggestions = this.plan(opts.stock);
    const groups = groupByVendor(suggestions);
    const result: ReorderRunResult = {
      dryRun,
      suggestions,
      purchaseOrders: [],
      skippedNoVendor: groups['unassigned'] ?? [],
    };

    for (const [vendorId, lines] of Object.entries(groups)) {
      if (vendorId === 'unassigned' || dryRun) continue;
      const id = this.deps.purchaseOrders.createPurchaseOrder({
        vendorId,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        memo: `Auto-reorder (${this.profile.id} profile)`,
        locationId: opts.locationId,
      });
      result.purchaseOrders.push({ vendorId, id, lines: lines.length });
    }

    this.log.info('Reorder run', {
      profile: this.profile.id,
      dryRun,
      suggestions: suggestions.length,
      purchaseOrders: result.purchaseOrders.length,
    });
    return result;
  }
}
