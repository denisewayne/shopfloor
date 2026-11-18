/**
 * Inventory Service: finds items below their reorder point and turns the
 * suggestions into one purchase order per vendor.
 *
 * Data source: an item search (or your own saved search with the same
 * column labels: available, onorder, demand, reorderpoint, preferred,
 * leadtime, vendor). Swap the search for whatever fits your account.
 */
import { BaseService } from './BaseService';
import { PurchaseOrderDAO } from '../dao/PurchaseOrderDAO';
import { BusinessProfile, getProfile } from '../profiles';
import { StockSnapshot, ReorderSuggestion, suggestReorder, groupByVendor } from '../domain/inventory';
import { runSearch, runSavedSearch } from '../utils/search';
import { SearchResultRow, InternalId } from '../types';
import { Logger } from '../utils/logger';

export interface ReorderRunResult {
  suggestions: ReorderSuggestion[];
  purchaseOrders: Array<{ vendorId: string; id: number; lines: number }>;
  skippedNoVendor: ReorderSuggestion[];
}

export class InventoryService extends BaseService {
  private readonly poDao = new PurchaseOrderDAO();
  private readonly profile: BusinessProfile;

  constructor(profile: BusinessProfile = getProfile()) {
    super('InventoryService');
    this.profile = profile;
  }

  /** Read stock levels from NetSuite. */
  loadStock(savedSearchId?: string | null): StockSnapshot[] {
    return this.execute('loadStock', () => {
      const rows = savedSearchId
        ? runSavedSearch(savedSearchId)
        : runSearch(
            'inventoryitem',
            [{ name: 'isinactive', operator: 'is', values: 'F' }],
            [
              { name: 'itemid', label: 'name' },
              { name: 'quantityavailable', label: 'available' },
              { name: 'quantityonorder', label: 'onorder' },
              { name: 'reorderpoint', label: 'reorderpoint' },
              { name: 'preferredstocklevel', label: 'preferred' },
              { name: 'leadtime', label: 'leadtime' },
              { name: 'othervendor', label: 'vendor' },
            ]
          );
      return rows.map(rowToSnapshot);
    });
  }

  /** Pure planning step: which items need restocking. */
  plan(stock: StockSnapshot[]): ReorderSuggestion[] {
    return stock
      .map((s) => suggestReorder(s, this.profile))
      .filter((s): s is ReorderSuggestion => s !== null);
  }

  /**
   * Full run: plan, then optionally create draft POs.
   * With dryRun=true nothing is written, which is the safe default for a first deploy.
   */
  run(stock: StockSnapshot[], dryRun = true, location?: InternalId): ReorderRunResult {
    return this.execute('run', () => {
      const suggestions = this.plan(stock);
      const groups = groupByVendor(suggestions);
      const result: ReorderRunResult = { suggestions, purchaseOrders: [], skippedNoVendor: groups['unassigned'] ?? [] };

      for (const [vendorId, lines] of Object.entries(groups)) {
        if (vendorId === 'unassigned' || dryRun) continue;
        const id = this.poDao.createForVendor(
          vendorId,
          lines.map((l) => ({ item: l.itemId, quantity: l.quantity })),
          `Auto-reorder (${this.profile.id} profile)`,
          location
        );
        result.purchaseOrders.push({ vendorId, id, lines: lines.length });
      }

      Logger.audit('Reorder run', {
        suggestions: suggestions.length,
        purchaseOrders: result.purchaseOrders.length,
        dryRun,
      });
      return result;
    });
  }
}

function num(v: SearchResultRow['values'][string] | undefined): number | undefined {
  if (v === undefined) return undefined;
  const raw = typeof v === 'string' ? v : v.value;
  if (raw === '' || raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: SearchResultRow['values'][string] | undefined): string | undefined {
  if (v === undefined) return undefined;
  const raw = typeof v === 'string' ? v : v.value;
  return raw === '' ? undefined : raw;
}

function text(v: SearchResultRow['values'][string] | undefined): string {
  if (v === undefined) return '';
  return typeof v === 'string' ? v : v.text || v.value;
}

export function rowToSnapshot(row: SearchResultRow): StockSnapshot {
  const v = row.values;
  return {
    itemId: row.id,
    name: text(v['name']),
    available: num(v['available']) ?? 0,
    onOrder: num(v['onorder']) ?? 0,
    dailyDemand: num(v['demand']) ?? 0,
    reorderPoint: num(v['reorderpoint']),
    preferredStockLevel: num(v['preferred']),
    leadTimeDays: num(v['leadtime']),
    vendorId: str(v['vendor']),
  };
}
