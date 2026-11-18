/**
 * Scheduled Script: nightly reorder check.
 *
 * Finds items at or below their reorder point and creates one purchase order
 * per preferred vendor. Ships in dry-run mode: tick the "Create purchase
 * orders" parameter once the logged suggestions look right.
 *
 * Parameter ids come from src/netsuite/adapter/config.ts (params section).
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import { shouldYield } from '../../utils/governance';
import { defaultNetSuiteConfig, makeNetSuiteConfig } from '../../adapter/config';
import { param, shopfloor } from '../../adapter/runtime';
import { netSuiteLogger } from '../../adapter/index';

export const execute: EntryPoints.Scheduled.execute = (): void => {
  const p = defaultNetSuiteConfig.params;
  const savedSearchId = param(p.reorderSearch);
  const config = savedSearchId
    ? makeNetSuiteConfig({ inventory: { savedSearchId: String(savedSearchId) } })
    : defaultNetSuiteConfig;

  const sf = shopfloor(config);
  const stock = sf.backend.listStock();
  if (shouldYield()) {
    netSuiteLogger.warn('Reorder: low governance after loading stock, stopping early');
    return;
  }

  const location = param(p.reorderLocation);
  const result = sf.inventory.run({
    stock,
    dryRun: param(p.reorderCreatePos) !== true,
    locationId: location ? String(location) : undefined,
  });

  netSuiteLogger.info('Reorder complete', {
    profile: sf.profile.id,
    dryRun: result.dryRun,
    suggestions: result.suggestions.map((s) => `${s.name} x${s.quantity}`),
    purchaseOrders: result.purchaseOrders.map((po) => po.id),
    noVendor: result.skippedNoVendor.map((s) => s.name),
  });
};
