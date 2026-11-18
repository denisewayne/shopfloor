/**
 * Scheduled Script: nightly reorder check.
 *
 * Finds items at or below their reorder point and creates one purchase order
 * per preferred vendor. Ships in dry-run mode: set the deployment parameter
 * `custscript_reorder_create_pos` to true once the suggestions look right.
 *
 * Parameters:
 *   custscript_business_profile   general | manufacturing | retail
 *   custscript_reorder_search     optional saved search id
 *   custscript_reorder_create_pos checkbox, default false (dry run)
 *   custscript_reorder_location   optional location id for the POs
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import { Logger } from '../../utils/logger';
import { getProfileParameter, getScriptParameter, shouldYield } from '../../utils/governance';
import { getProfile } from '../../profiles';
import { InventoryService } from '../../services/InventoryService';

export const execute: EntryPoints.Scheduled.execute = (): void => {
  const profile = getProfile(getProfileParameter());
  const service = new InventoryService(profile);

  const searchId = getScriptParameter('custscript_reorder_search') as string | null;
  const createPos = getScriptParameter('custscript_reorder_create_pos') === true;
  const location = getScriptParameter('custscript_reorder_location') as string | null;

  const stock = service.loadStock(searchId);
  if (shouldYield()) {
    Logger.audit('Reorder: low governance after loading stock, stopping early');
    return;
  }

  const result = service.run(stock, !createPos, location ?? undefined);

  Logger.audit('Reorder complete', {
    profile: profile.id,
    dryRun: !createPos,
    suggestions: result.suggestions.length,
    purchaseOrders: result.purchaseOrders.map((p) => p.id).join(','),
    noVendor: result.skippedNoVendor.map((s) => s.name).join(','),
  });
};
