/**
 * Production planning for assembly and batch manufacturing. Pure functions.
 */
import { BusinessProfile } from '../profiles/index';
import { roundUpTo } from './inventory';

export interface BomComponent {
  itemId: string;
  /** Units of component per one finished unit. */
  quantityPer: number;
}

export interface BuildPlan {
  assemblyId: string;
  buildQuantity: number;
  /** Total component requirement, scrap included. */
  components: Array<{ itemId: string; required: number }>;
}

/**
 * How many units to build: cover open demand not met by stock,
 * pad for scrap, then round to the profile's batch size.
 * Returns 0 when nothing needs building.
 */
export function planBuildQuantity(
  openDemand: number,
  available: number,
  profile: BusinessProfile
): number {
  const net = openDemand - available;
  if (net <= 0) return 0;

  const withScrap = net / (1 - profile.production.scrapRate);
  const batched = roundUpTo(withScrap, profile.production.batchMultiple);
  return Math.max(batched, profile.production.minBatchSize);
}

/** Explode a BOM for a build quantity, rounding component needs up. */
export function explodeBom(
  assemblyId: string,
  buildQuantity: number,
  bom: BomComponent[]
): BuildPlan {
  return {
    assemblyId,
    buildQuantity,
    components: bom.map((c) => ({
      itemId: c.itemId,
      required: Math.ceil(c.quantityPer * buildQuantity * 1e6) / 1e6,
    })),
  };
}

/** Components where on-hand stock cannot cover the build. */
export function findShortages(
  plan: BuildPlan,
  availableByItem: Record<string, number>
): Array<{ itemId: string; required: number; available: number; short: number }> {
  return plan.components
    .map((c) => {
      const available = availableByItem[c.itemId] ?? 0;
      return { itemId: c.itemId, required: c.required, available, short: c.required - available };
    })
    .filter((c) => c.short > 0);
}
