/**
 * Ports: the only things the core services need from a back end.
 *
 * Implement these for any system (NetSuite, a database, a CSV folder, another
 * ERP) and every Shopfloor service works unchanged. Keep them small and
 * synchronous: NetSuite's SuiteScript runtime is synchronous, and async
 * back ends can preload data before calling a service.
 */
import { StockSnapshot } from '../domain/inventory';
import { SaleLine } from '../domain/retail';

export type Id = string;

export interface Logger {
  debug(title: string, details?: unknown): void;
  info(title: string, details?: unknown): void;
  warn(title: string, details?: unknown): void;
  error(title: string, details?: unknown): void;
}

/** Reads current stock levels and replenishment settings per item. */
export interface StockSource {
  listStock(): StockSnapshot[];
}

export interface PurchaseOrderDraft {
  vendorId: Id;
  lines: Array<{ itemId: Id; quantity: number }>;
  memo?: string;
  locationId?: Id;
}

/** Creates purchase orders. Returns the new document id. */
export interface PurchaseOrderWriter {
  createPurchaseOrder(draft: PurchaseOrderDraft): Id;
}

export interface WorkOrderDraft {
  assemblyId: Id;
  quantity: number;
  locationId?: Id;
  subsidiaryId?: Id;
  /** Sales order or other demand document this build is for. */
  sourceId?: Id;
  memo?: string;
}

/** Creates production / work orders. Returns the new document id. */
export interface WorkOrderWriter {
  createWorkOrder(draft: WorkOrderDraft): Id;
}

/** Reads a day's point-of-sale / cash sale lines. */
export interface SalesSource {
  listSales(date: string): { lines: SaleLine[]; transactions: number };
}

/** A logger that discards everything. Handy default for tests and scripts. */
export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
