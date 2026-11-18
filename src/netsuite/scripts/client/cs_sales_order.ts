/**
 * Client Script — runs in the browser for real-time UI behavior.
 *
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as dialog from 'N/ui/dialog';
import * as currentRecord from 'N/currentRecord';

/**
 * Fires when the page loads.
 */
export const pageInit: EntryPoints.Client.pageInit = (
  context: EntryPoints.Client.pageInitContext
): void => {
  const mode = context.mode; // 'create' | 'edit' | 'copy' | 'view'

  if (mode === 'create') {
    // Set defaults for new records
    // context.currentRecord.setValue({ fieldId: 'custbody_source', value: 'UI' });
  }
};

/**
 * Fires when a body field value changes.
 */
export const fieldChanged: EntryPoints.Client.fieldChanged = (
  context: EntryPoints.Client.fieldChangedContext
): void => {
  const fieldId = context.fieldId;
  const rec = context.currentRecord;

  if (fieldId === 'entity') {
    // Example: auto-populate related fields when customer changes
    // const customer = rec.getValue({ fieldId: 'entity' });
    // rec.setValue({ fieldId: 'custbody_segment', value: lookupSegment(customer) });
  }

  if (fieldId === 'custbody_discount_pct') {
    // Recalculate line amounts when discount changes
    const lineCount = rec.getLineCount({ sublistId: 'item' });
    const discountPct = Number(rec.getValue({ fieldId: 'custbody_discount_pct' })) / 100;

    for (let i = 0; i < lineCount; i++) {
      const rate = Number(rec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i }));
      const discountedRate = rate * (1 - discountPct);
      rec.selectLine({ sublistId: 'item', line: i });
      rec.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: discountedRate });
      rec.commitLine({ sublistId: 'item' });
    }
  }
};

/**
 * Fires when a sublist field changes.
 */
export const sublistChanged: EntryPoints.Client.sublistChanged = (
  context: EntryPoints.Client.sublistChangedContext
): void => {
  if (context.sublistId === 'item') {
    // Recalculate totals, update summary fields, etc.
  }
};

/**
 * Fires before the record is submitted (save button).
 * Return true to allow save, false to block.
 */
export const saveRecord: EntryPoints.Client.saveRecord = (
  _context: EntryPoints.Client.saveRecordContext
): boolean => {
  const rec = currentRecord.get();
  const lineCount = rec.getLineCount({ sublistId: 'item' });

  if (lineCount === 0) {
    dialog.alert({
      title: 'Validation Error',
      message: 'Please add at least one line item before saving.',
    });
    return false;
  }

  return true;
};

/**
 * Validates a sublist line before it is committed.
 * Return true to allow commit, false to block.
 */
export const validateLine: EntryPoints.Client.validateLine = (
  context: EntryPoints.Client.validateLineContext
): boolean => {
  if (context.sublistId === 'item') {
    const rec = context.currentRecord;
    const qty = Number(rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' }));

    if (qty <= 0) {
      dialog.alert({
        title: 'Invalid Quantity',
        message: 'Quantity must be greater than zero.',
      });
      return false;
    }
  }
  return true;
};
