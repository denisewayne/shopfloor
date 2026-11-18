/**
 * NetSuite configuration: every account-specific ID Shopfloor touches lives
 * here. Edit this file (or override per deployment) instead of the code.
 *
 * Script parameter ids live in src/netsuite/deploy/manifest.ts.
 *
 * Column labels on the left are what the adapter reads. Field and column IDs
 * on the right are NetSuite's. If your account stores lead time in a custom
 * field, change `leadtime: 'leadtime'` to `leadtime: 'custitem_lead_days'`.
 */

export interface NetSuiteConfig {
  inventory: {
    /** Record type searched for stock levels. */
    itemSearchType: string;
    /** Optional saved search id. Its column labels must match `columns` keys. */
    savedSearchId: string | null;
    /** Extra filters, e.g. only one location or one item class. */
    filters: Array<{ name: string; operator: string; values: string | string[] }>;
    /** label -> NetSuite column id. `demand` has no standard field, so add your own. */
    columns: {
      name: string;
      available: string;
      onorder: string;
      reorderpoint: string;
      preferred: string;
      leadtime: string;
      vendor: string;
      demand?: string;
    };
  };
  purchaseOrder: {
    recordType: string;
    /** Extra body fields to set on every generated PO (e.g. approval status, custom form). */
    defaults: Record<string, string | number | boolean>;
  };
  workOrder: {
    recordType: string;
    assemblyField: string;
    sourceField: string;
    defaults: Record<string, string | number | boolean>;
  };
  sales: {
    /** Transaction type used for POS / walk-in sales. */
    recordType: string;
    columns: { item: string; quantity: string; amount: string; payment: string };
  };
}

export const defaultNetSuiteConfig: NetSuiteConfig = {
  inventory: {
    itemSearchType: 'inventoryitem',
    savedSearchId: null,
    filters: [{ name: 'isinactive', operator: 'is', values: 'F' }],
    columns: {
      name: 'itemid',
      available: 'quantityavailable',
      onorder: 'quantityonorder',
      reorderpoint: 'reorderpoint',
      preferred: 'preferredstocklevel',
      leadtime: 'leadtime',
      vendor: 'othervendor',
    },
  },
  purchaseOrder: { recordType: 'purchaseorder', defaults: {} },
  workOrder: { recordType: 'workorder', assemblyField: 'assemblyitem', sourceField: 'createdfrom', defaults: {} },
  sales: {
    recordType: 'cashsale',
    columns: { item: 'item', quantity: 'quantity', amount: 'amount', payment: 'paymentmethod' },
  },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Merge overrides onto the defaults (one level per section). */
export function makeNetSuiteConfig(overrides: DeepPartial<NetSuiteConfig> = {}): NetSuiteConfig {
  const d = defaultNetSuiteConfig;
  const o = overrides;
  return {
    inventory: {
      ...d.inventory,
      ...(o.inventory as Partial<NetSuiteConfig['inventory']>),
      columns: { ...d.inventory.columns, ...(o.inventory?.columns as Partial<NetSuiteConfig['inventory']['columns']>) },
      filters: (o.inventory?.filters as NetSuiteConfig['inventory']['filters']) ?? d.inventory.filters,
    },
    purchaseOrder: { ...d.purchaseOrder, ...(o.purchaseOrder as Partial<NetSuiteConfig['purchaseOrder']>) },
    workOrder: { ...d.workOrder, ...(o.workOrder as Partial<NetSuiteConfig['workOrder']>) },
    sales: {
      ...d.sales,
      ...(o.sales as Partial<NetSuiteConfig['sales']>),
      columns: { ...d.sales.columns, ...(o.sales?.columns as Partial<NetSuiteConfig['sales']['columns']>) },
    },
  };
}
