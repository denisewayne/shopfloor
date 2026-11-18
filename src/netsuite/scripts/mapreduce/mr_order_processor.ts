/**
 * Map/Reduce script — NetSuite's parallel processing engine.
 *
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * The four stages:
 *   getInputData  → returns the dataset (search, query, or array)
 *   map           → transform each input row (runs in parallel)
 *   reduce        → aggregate mapped values by key (runs in parallel)
 *   summarize     → final reporting / error handling (runs once)
 */

import { EntryPoints } from 'N/types';
import * as search from 'N/search';
import { Logger } from '../../utils/logger';

// ─── Stage 1: Input ──────────────────────────────────────────────

export const getInputData: EntryPoints.MapReduce.getInputData = (): search.Search => {
  Logger.audit('Map/Reduce: getInputData');

  // Return a search object, array, or search.Search.
  // NetSuite automatically pages through results.
  return search.create({
    type: 'salesorder',
    filters: [
      search.createFilter({
        name: 'status',
        operator: search.Operator.ANYOF,
        values: ['SalesOrd:B'], // Pending Fulfillment
      }),
      search.createFilter({
        name: 'mainline',
        operator: search.Operator.IS,
        values: ['T'],
      }),
    ],
    columns: [
      search.createColumn({ name: 'internalid' }),
      search.createColumn({ name: 'tranid' }),
      search.createColumn({ name: 'entity' }),
      search.createColumn({ name: 'total' }),
    ],
  });
};

// ─── Stage 2: Map ────────────────────────────────────────────────

export const map: EntryPoints.MapReduce.map = (
  context: EntryPoints.MapReduce.mapContext
): void => {
  try {
    const searchResult = JSON.parse(context.value);
    const orderId = searchResult.id;
    const entity = searchResult.values?.entity?.value ?? searchResult.values?.entity;

    Logger.debug('Map stage', { orderId, entity } as unknown as string);

    // Emit: key = customer, value = order data
    // Reduce will group all orders by customer
    context.write({
      key: String(entity),
      value: JSON.stringify({
        orderId,
        total: searchResult.values?.total,
      }),
    });
  } catch (e) {
    Logger.error('Map error', e as Error);
  }
};

// ─── Stage 3: Reduce ─────────────────────────────────────────────

export const reduce: EntryPoints.MapReduce.reduce = (
  context: EntryPoints.MapReduce.reduceContext
): void => {
  try {
    const customerId = context.key;
    const orders = context.values.map((v) => JSON.parse(v));

    Logger.debug('Reduce stage', {
      customerId,
      orderCount: String(orders.length),
    } as unknown as string);

    // Process grouped data — e.g., create consolidated invoice,
    // send batch notification, update customer record, etc.

    context.write({
      key: customerId,
      value: JSON.stringify({
        processedCount: orders.length,
        totalValue: orders.reduce((sum: number, o: { total: string }) => sum + Number(o.total || 0), 0),
      }),
    });
  } catch (e) {
    Logger.error('Reduce error', e as Error);
  }
};

// ─── Stage 4: Summarize ──────────────────────────────────────────

export const summarize: EntryPoints.MapReduce.summarize = (
  summary: EntryPoints.MapReduce.summarizeContext
): void => {
  Logger.audit('Map/Reduce: summarize');

  // Report input errors
  if (summary.inputSummary.error) {
    Logger.error('Input stage error', summary.inputSummary.error);
  }

  // Report map errors
  let mapErrors = 0;
  summary.mapSummary.errors.iterator().each((_key: string, error: string) => {
    Logger.error('Map error', error);
    mapErrors++;
    return true;
  });

  // Report reduce errors
  let reduceErrors = 0;
  summary.reduceSummary.errors.iterator().each((_key: string, error: string) => {
    Logger.error('Reduce error', error);
    reduceErrors++;
    return true;
  });

  // Collect output
  let totalProcessed = 0;
  summary.output.iterator().each((_key: string, value: string) => {
    const result = JSON.parse(value);
    totalProcessed += result.processedCount;
    return true;
  });

  Logger.audit('Map/Reduce complete', {
    mapErrors: String(mapErrors),
    reduceErrors: String(reduceErrors),
    totalProcessed: String(totalProcessed),
    concurrency: String(summary.concurrency),
    usage: String(summary.usage),
    yields: String(summary.yields),
  } as unknown as string);
};
