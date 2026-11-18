/**
 * Scheduled Script: end-of-day sales close-out for a shop.
 *
 * Totals the day's cash sales by payment method and logs the summary.
 * Use the RESTlet `closeDay` action when the counted cash comes from the
 * register.
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as format from 'N/format';
import { shouldYield } from '../../utils/governance';
import { defaultNetSuiteConfig } from '../../adapter/config';
import { param, shopfloor } from '../../adapter/runtime';
import { netSuiteLogger } from '../../adapter/index';

export const execute: EntryPoints.Scheduled.execute = (): void => {
  if (shouldYield()) return;
  const sf = shopfloor(defaultNetSuiteConfig, 'retail');
  const override = param(defaultNetSuiteConfig.params.closeDate);
  const date = override
    ? String(override)
    : (format.format({ value: new Date(), type: format.Type.DATE }) as string);

  const summary = sf.retail.closeDay(date, null);
  netSuiteLogger.info(`Daily close ${date}`, summary);
};
