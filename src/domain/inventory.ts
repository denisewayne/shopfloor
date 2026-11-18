/**
 * Inventory reorder math. Pure functions, no N/* imports, so they run
 * anywhere (Jest, a spreadsheet export, a CLI) and are easy to reason about.
 */
import { BusinessProfile } from '../profiles';

export interface StockSnapshot {
  itemId: string;
  name: string;
  /** On hand minus committed. */
  available: number;
  /** Already on open purchase orders / work orders. */
  onOrder: number;
  /** Average units sold or consumed per day. 0 if unknown. */
  dailyDemand: number;
  reorderPoint?: number;
  preferredStockLevel?: number;
  leadTimeDays?: number;
  orderMultiple?: number;
  vendorId?: string;
}

export interface ReorderSuggestion {
  itemId: string;
  name: string;
  vendorId?: string;
  quantity: number;
  reason: string;
}

/** Round up to the nearest multiple (multiple <= 1 means no rounding). */
export function roundUpTo(qty: number, multiple: number): number {
  // Trim float noise first so 100.00000000000001 does not round up to 110.
  const clean = (n: number): number => Math.round(n * 1e6) / 1e6;
  if (multiple <= 1) return Math.ceil(clean(qty));
  return Math.ceil(clean(qty / multiple)) * multiple;
}

/**
 * Decide whether an item needs reordering and how many to buy.
 *
 * Reorder point: the item's own value, or demand over (lead time + safety days).
 * Target level:  the item's preferred stock level, or reorder point plus one
 *                lead time of demand.
 */
export function suggestReorder(
  stock: StockSnapshot,
  profile: BusinessProfile
): ReorderSuggestion | null {
  const lead = stock.leadTimeDays ?? profile.inventory.defaultLeadTimeDays;
  const reorderPoint =
    stock.reorderPoint ?? stock.dailyDemand * (lead + profile.inventory.safetyStockDays);

  const position = stock.available + stock.onOrder;
  if (position > reorderPoint) return null;

  const target = stock.preferredStockLevel ?? reorderPoint + stock.dailyDemand * lead;
  const shortfall = target - position;
  if (shortfall <= 0) return null;

  const multiple = stock.orderMultiple ?? profile.inventory.defaultOrderMultiple;
  const quantity = roundUpTo(shortfall, multiple);

  return {
    itemId: stock.itemId,
    name: stock.name,
    vendorId: stock.vendorId,
    quantity,
    reason: `position ${position} <= reorder point ${round2(reorderPoint)}, target ${round2(target)}`,
  };
}

/** Group suggestions by vendor so each vendor gets one purchase order. */
export function groupByVendor(
  suggestions: ReorderSuggestion[]
): Record<string, ReorderSuggestion[]> {
  const groups: Record<string, ReorderSuggestion[]> = {};
  for (const s of suggestions) {
    const key = s.vendorId ?? 'unassigned';
    (groups[key] ??= []).push(s);
  }
  return groups;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
