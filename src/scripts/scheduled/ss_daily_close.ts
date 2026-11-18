/**
 * Scheduled Script: end-of-day sales close-out for a shop.
 *
 * Totals today's cash sales by payment method and logs the summary.
 * Pair with the RESTlet `closeDay` action if the counted cash comes from a
 * POS or a tablet at the register.
 *
 * Parameters:
 *   custscript_business_profile  usually `retail`
 *   custscript_close_date        optional date override (MM/DD/YYYY)
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as format from 'N/format';
import { Logger } from '../../utils/logger';
import { getProfileParameter, getScriptParameter, shouldYield } from '../../utils/governance';
import { getProfile } from '../../profiles';
import { RetailService } from '../../services/RetailService';

export const execute: EntryPoints.Scheduled.execute = (): void => {
  if (shouldYield()) return;
  const profile = getProfile(getProfileParameter() ?? 'retail');
  const date =
    (getScriptParameter('custscript_close_date') as string | null) ||
    (format.format({ value: new Date(), type: format.Type.DATE }) as string);

  const summary = new RetailService(profile).closeDay(date, null);
  Logger.audit(`Daily close ${date}`, summary as unknown as Record<string, unknown>);
};
