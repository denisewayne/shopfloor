/**
 * Scheduled Script: nightly reorder check.
 *
 * Finds items at or below their reorder point and creates one purchase order
 * per preferred vendor. Ships in dry-run mode: tick "Create purchase orders"
 * on the deployment once the logged suggestions look right.
 *
 * Script record, deployment, and parameters: src/netsuite/deploy/manifest.ts
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
import { SCRIPTS } from '../../deploy/manifest';

const P = SCRIPTS.inventoryReorder.params;

export const execute: EntryPoints.Scheduled.execute = (): void => {
  const savedSearchId = param(P.savedSearch.id);
  const config = savedSearchId
    ? makeNetSuiteConfig({ inventory: { savedSearchId: String(savedSearchId) } })
    : defaultNetSuiteConfig;

  const sf = shopfloor(P.profile.id, 'general', config);
  const stock = sf.backend.listStock();
  if (shouldYield()) {
    netSuiteLogger.warn('Reorder: low governance after loading stock, stopping early');
    return;
  }

  const location = param(P.location.id);
  const result = sf.inventory.run({
    stock,
    dryRun: param(P.createPos.id) !== true,
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
