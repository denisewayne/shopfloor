/**
 * Scheduled Script — runs on a cron schedule or triggered manually.
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as task from 'N/task';
import { Logger } from '../../utils/logger';
import { shouldYield, getRemainingUsage, getScriptParameter } from '../../utils/governance';
import { runSearch, runSavedSearch } from '../../utils/search';

/**
 * Main entry point for the scheduled script.
 *
 * Pattern: query for work items, iterate with governance check,
 * reschedule self if work remains.
 */
export const execute: EntryPoints.Scheduled.execute = (
  context: EntryPoints.Scheduled.executeContext
): void => {
  Logger.audit('Scheduled script started', {
    deploymentId: context.toString(),
  } as unknown as string);

  try {
    // Read deployment parameters
    const batchSize = Number(getScriptParameter('custscript_batch_size') ?? 100);
    const searchId = getScriptParameter('custscript_saved_search') as string | null;

    // Use the deployment's saved search if configured, otherwise fall back to
    // sales orders pending fulfillment.
    const records = searchId
      ? runSavedSearch(searchId)
      : runSearch(
          'salesorder',
          [{ name: 'status', operator: 'anyof', values: 'SalesOrd:B' }],
          [{ name: 'internalid' }, { name: 'tranid' }, { name: 'entity' }]
        );

    Logger.audit('Records to process', { count: String(records.length) } as unknown as string);

    let processed = 0;

    for (const record of records) {
      // Governance gate — yield before running out of units
      if (shouldYield()) {
        Logger.audit('Yielding due to governance', {
          processed: String(processed),
          remaining: String(getRemainingUsage()),
        } as unknown as string);

        reschedule();
        return;
      }

      // ── Process one record ──
      try {
        processRecord(record.id);
        processed++;
      } catch (e) {
        Logger.error(`Failed to process record ${record.id}`, e as Error);
        // Continue — don't let one failure stop the batch
      }

      if (processed >= batchSize) {
        Logger.audit('Batch limit reached, rescheduling', {
          processed: String(processed),
        } as unknown as string);
        reschedule();
        return;
      }
    }

    Logger.audit('Scheduled script complete', {
      processed: String(processed),
      total: String(records.length),
    } as unknown as string);
  } catch (e) {
    Logger.error('Scheduled script failed', e as Error);
    throw e;
  }
};

// ─── Helpers ─────────────────────────────────────────────────────

function processRecord(_recordId: string): void {
  // Implement your per-record processing here
  // e.g., create item fulfillment, sync to external system, etc.
}

function reschedule(): void {
  try {
    const scriptTask = task.create({
      taskType: task.TaskType.SCHEDULED_SCRIPT,
    });
    // scriptTask.scriptId = runtime.getCurrentScript().id;
    // scriptTask.deploymentId = runtime.getCurrentScript().deploymentId;
    scriptTask.submit();
    Logger.audit('Script rescheduled');
  } catch (e) {
    Logger.error('Failed to reschedule', e as Error);
  }
}
