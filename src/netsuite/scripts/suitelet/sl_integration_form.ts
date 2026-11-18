/**
 * Suitelet — serves custom UI pages and handles form submissions.
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as serverWidget from 'N/ui/serverWidget';
import * as redirect from 'N/redirect';
import { Logger } from '../../utils/logger';

/**
 * Serves both GET (render form) and POST (handle submission).
 */
export const onRequest: EntryPoints.Suitelet.onRequest = (
  context: EntryPoints.Suitelet.onRequestContext
): void => {
  try {
    if (context.request.method === 'GET') {
      renderForm(context);
    } else {
      handleSubmission(context);
    }
  } catch (e) {
    Logger.error('Suitelet error', e as Error);
    context.response.write({
      output: `<html><body><h2>Error</h2><p>${(e as Error).message}</p></body></html>`,
    });
  }
};

// ─── Form Rendering ──────────────────────────────────────────────

function renderForm(context: EntryPoints.Suitelet.onRequestContext): void {
  const form = serverWidget.createForm({ title: 'Custom Integration Form' });

  // Add a field group
  form.addFieldGroup({ id: 'custgroup_main', label: 'Main' });

  // Customer select
  const customerField = form.addField({
    id: 'custpage_customer',
    type: serverWidget.FieldType.SELECT,
    label: 'Customer',
    source: 'customer',
    container: 'custgroup_main',
  });
  customerField.isMandatory = true;

  // Date range
  form.addField({
    id: 'custpage_date_from',
    type: serverWidget.FieldType.DATE,
    label: 'Date From',
    container: 'custgroup_main',
  });

  form.addField({
    id: 'custpage_date_to',
    type: serverWidget.FieldType.DATE,
    label: 'Date To',
    container: 'custgroup_main',
  });

  // Memo
  form.addField({
    id: 'custpage_memo',
    type: serverWidget.FieldType.TEXTAREA,
    label: 'Notes',
    container: 'custgroup_main',
  });

  form.addSubmitButton({ label: 'Submit' });
  form.addResetButton({ label: 'Reset' });

  context.response.writePage({ pageObject: form });
}

// ─── Form Submission ─────────────────────────────────────────────

function handleSubmission(context: EntryPoints.Suitelet.onRequestContext): void {
  const params = context.request.parameters;
  const customerId = params.custpage_customer;
  const dateFrom = params.custpage_date_from;
  const dateTo = params.custpage_date_to;
  const memo = params.custpage_memo;

  Logger.audit('Suitelet form submitted', {
    customerId,
    dateFrom,
    dateTo,
    memo,
  } as unknown as string);

  // Process the submission...
  // e.g., create a record, trigger a search, queue a scheduled script

  // Redirect back to the form or to a record
  redirect.toSuitelet({
    scriptId: 'customscript_sl_integration_form',
    deploymentId: 'customdeploy_sl_integration_form',
    parameters: { submitted: 'T' },
  });
}
