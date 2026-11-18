/**
 * User Event script — fires on record create/edit/delete in the UI,
 * CSV import, web services, and other contexts.
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import { Logger } from '../../utils/logger';
import { isContext } from '../../utils/governance';
import { ExecutionContext } from '../../constants/index';

/**
 * Runs before the record is loaded into the UI.
 * Typical uses: hide/show fields, set defaults, modify sublists for display.
 */
export const beforeLoad: EntryPoints.UserEvent.beforeLoad = (
  context: EntryPoints.UserEvent.beforeLoadContext
): void => {
  try {
    const { newRecord, type } = context;
    Logger.debug('beforeLoad', { type, id: newRecord.id } as unknown as string);

    // Example: set a default field value only in UI context
    if (isContext(ExecutionContext.USER_INTERFACE) && type === context.UserEventType.CREATE) {
      // newRecord.setValue({ fieldId: 'custbody_source', value: 'MANUAL' });
    }
  } catch (e) {
    Logger.error('beforeLoad error', e as Error);
    // Don't re-throw in beforeLoad unless you want to block the page load
  }
};

/**
 * Runs after validation but before the record is saved to the DB.
 * Typical uses: server-side validation, auto-fill computed fields,
 * prevent save on business rule violations.
 */
export const beforeSubmit: EntryPoints.UserEvent.beforeSubmit = (
  context: EntryPoints.UserEvent.beforeSubmitContext
): void => {
  try {
    const { newRecord, type } = context;
    Logger.debug('beforeSubmit', { type, id: newRecord.id } as unknown as string);

    if (type === context.UserEventType.CREATE || type === context.UserEventType.EDIT) {
      // Example: server-side validation
      // const total = newRecord.getValue({ fieldId: 'total' });
      // if (Number(total) > 100000) {
      //   throw error.create({ name: 'OVER_LIMIT', message: 'Order exceeds $100k limit' });
      // }
    }
  } catch (e) {
    Logger.error('beforeSubmit error', e as Error);
    throw e; // Re-throw to block the save
  }
};

/**
 * Runs after the record is saved to the DB.
 * Typical uses: send notifications, trigger integrations, create
 * related records, update dashboards.
 */
export const afterSubmit: EntryPoints.UserEvent.afterSubmit = (
  context: EntryPoints.UserEvent.afterSubmitContext
): void => {
  try {
    const { newRecord, type } = context;
    Logger.audit('afterSubmit', { type, id: newRecord.id, recordType: newRecord.type } as unknown as string);

    if (type === context.UserEventType.CREATE) {
      // Example: fire an integration webhook after record creation
      // integrationService.notifyExternalSystem(newRecord);
    }

    if (type === context.UserEventType.EDIT) {
      // Example: detect status change (destructure oldRecord from context)
      // const oldStatus = oldRecord?.getValue({ fieldId: 'status' });
      // const newStatus = newRecord.getValue({ fieldId: 'status' });
      // if (oldStatus !== newStatus) {
      //   notificationService.sendStatusChange(newRecord.id, oldStatus, newStatus);
      // }
    }
  } catch (e) {
    Logger.error('afterSubmit error', e as Error);
    // Usually don't re-throw in afterSubmit — the record is already saved
  }
};
