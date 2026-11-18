/**
 * Business profiles: opinionated defaults for the kinds of companies this
 * starter is built for. A profile is plain data, so you can copy one,
 * tweak the numbers, and keep your business rules out of script code.
 *
 * Pick a profile per script deployment with the `custscript_business_profile`
 * parameter (values: general | manufacturing | retail). Anything not set falls
 * back to `general`.
 */

export type ProfileId = 'general' | 'manufacturing' | 'retail';

export interface BusinessProfile {
  id: ProfileId;
  label: string;
  /** Which optional modules are switched on for this kind of business. */
  modules: {
    inventoryReorder: boolean;
    production: boolean;
    dailySales: boolean;
  };
  orders: {
    /** Smallest order total accepted by SalesOrderService. */
    minOrderTotal: number;
    /** Hard cap on lines per order (NetSuite performance guard). */
    maxLines: number;
  };
  inventory: {
    /** Days of demand to keep on hand when no reorder point is set. */
    safetyStockDays: number;
    /** Supplier lead time used when the item has none. */
    defaultLeadTimeDays: number;
    /** Round purchase suggestions up to this pack size. */
    defaultOrderMultiple: number;
  };
  production: {
    /** Smallest work order worth releasing to the floor. */
    minBatchSize: number;
    /** Round builds up to this batch multiple (e.g. a mixer holds 50 units). */
    batchMultiple: number;
    /** Expected scrap rate, 0.03 = 3%. Builds are padded to cover it. */
    scrapRate: number;
  };
  retail: {
    /** Flag the day if cash over/short exceeds this amount. */
    cashVarianceTolerance: number;
    /** How many best sellers to include in the daily summary. */
    topItemsCount: number;
  };
}

export const PROFILES: Record<ProfileId, BusinessProfile> = {
  general: {
    id: 'general',
    label: 'Small business (services, distribution, B2B)',
    modules: { inventoryReorder: true, production: false, dailySales: false },
    orders: { minOrderTotal: 0.01, maxLines: 500 },
    inventory: { safetyStockDays: 14, defaultLeadTimeDays: 7, defaultOrderMultiple: 1 },
    production: { minBatchSize: 1, batchMultiple: 1, scrapRate: 0 },
    retail: { cashVarianceTolerance: 5, topItemsCount: 5 },
  },
  manufacturing: {
    id: 'manufacturing',
    label: 'Light manufacturing (assemblies, kits, batch production)',
    modules: { inventoryReorder: true, production: true, dailySales: false },
    orders: { minOrderTotal: 50, maxLines: 500 },
    inventory: { safetyStockDays: 21, defaultLeadTimeDays: 14, defaultOrderMultiple: 10 },
    production: { minBatchSize: 10, batchMultiple: 10, scrapRate: 0.03 },
    retail: { cashVarianceTolerance: 5, topItemsCount: 5 },
  },
  retail: {
    id: 'retail',
    label: 'Local shop (storefront, POS cash sales, small catalog)',
    modules: { inventoryReorder: true, production: false, dailySales: true },
    orders: { minOrderTotal: 0.01, maxLines: 200 },
    inventory: { safetyStockDays: 7, defaultLeadTimeDays: 5, defaultOrderMultiple: 1 },
    production: { minBatchSize: 1, batchMultiple: 1, scrapRate: 0 },
    retail: { cashVarianceTolerance: 2, topItemsCount: 10 },
  },
};

/** Resolve a profile by id, falling back to `general` for unknown values. */
export function getProfile(id?: string | null): BusinessProfile {
  if (id && id in PROFILES) return PROFILES[id as ProfileId];
  return PROFILES.general;
}
