/**
 * NetSuite implementation of the Shopfloor ports. All record types, field
 * ids and search columns come from NetSuiteConfig, never from the core.
 */
import { StockSnapshot } from '../../core/domain/inventory';
import { SaleLine } from '../../core/domain/retail';
import {
  Id,
  Logger,
  PurchaseOrderDraft,
  PurchaseOrderWriter,
  SalesSource,
  StockSource,
  WorkOrderDraft,
  WorkOrderWriter,
} from '../../core/ports/index';
import { ValidationError } from '../../core/errors';
import { BaseDAO, FieldMapping, SublistLineMapping } from '../dao/BaseDAO';
import { Fields, Sublists } from '../constants/index';
import { SearchResultRow } from '../types/index';
import { runSavedSearch, runSearch } from '../utils/search';
import { Logger as NsLog } from '../utils/logger';
import { NetSuiteConfig, defaultNetSuiteConfig } from './config';

export { NetSuiteConfig, defaultNetSuiteConfig, makeNetSuiteConfig } from './config';

/** Routes core log calls into the NetSuite execution log. */
export const netSuiteLogger: Logger = {
  debug: (t, d) => NsLog.debug(t, toDetails(d)),
  info: (t, d) => NsLog.audit(t, toDetails(d)),
  warn: (t, d) => NsLog.audit(`WARN ${t}`, toDetails(d)),
  error: (t, d) => NsLog.emergency(t, toDetails(d)),
};

function toDetails(d: unknown): string {
  if (d === undefined) return '';
  return typeof d === 'string' ? d : JSON.stringify(d);
}

/** Generic DAO bound to a record type chosen at runtime. */
class RecordWriter extends BaseDAO {
  constructor(protected readonly recordType: string) {
    super();
  }
  write(body: FieldMapping[], lines?: SublistLineMapping[]): number {
    return this.create(body, lines);
  }
}

function defaultsToFields(defaults: Record<string, string | number | boolean>): FieldMapping[] {
  return Object.entries(defaults).map(([fieldId, value]) => ({ fieldId, value }));
}

export class NetSuiteBackend implements StockSource, PurchaseOrderWriter, WorkOrderWriter, SalesSource {
  constructor(readonly config: NetSuiteConfig = defaultNetSuiteConfig) {}

  // ─── StockSource ─────────────────────────────────────────────
  listStock(): StockSnapshot[] {
    const inv = this.config.inventory;
    const rows = inv.savedSearchId
      ? runSavedSearch(inv.savedSearchId)
      : runSearch(
          inv.itemSearchType,
          inv.filters,
          Object.entries(inv.columns)
            .filter(([, id]) => !!id)
            .map(([label, name]) => ({ name: name as string, label }))
        );
    return rows.map(rowToSnapshot);
  }

  // ─── PurchaseOrderWriter ─────────────────────────────────────
  createPurchaseOrder(draft: PurchaseOrderDraft): Id {
    if (!draft.vendorId) throw new ValidationError('Vendor is required', 'vendorId');
    if (draft.lines.length === 0) throw new ValidationError('At least one line is required', 'lines');

    const body: FieldMapping[] = [
      { fieldId: Fields.ENTITY, value: Number(draft.vendorId) },
      ...defaultsToFields(this.config.purchaseOrder.defaults),
    ];
    if (draft.memo) body.push({ fieldId: Fields.MEMO, value: draft.memo });
    if (draft.locationId) body.push({ fieldId: Fields.LOCATION, value: Number(draft.locationId) });

    const lines: SublistLineMapping[] = draft.lines.map((l) => ({
      sublistId: Sublists.ITEM,
      fields: [
        { fieldId: Fields.ITEM, value: Number(l.itemId) },
        { fieldId: Fields.QUANTITY, value: l.quantity },
      ],
    }));
    return String(new RecordWriter(this.config.purchaseOrder.recordType).write(body, lines));
  }

  // ─── WorkOrderWriter ─────────────────────────────────────────
  createWorkOrder(draft: WorkOrderDraft): Id {
    if (!draft.assemblyId) throw new ValidationError('Assembly is required', 'assemblyId');
    if (!(draft.quantity > 0)) throw new ValidationError('Quantity must be positive', 'quantity');

    const wo = this.config.workOrder;
    const body: FieldMapping[] = [
      { fieldId: wo.assemblyField, value: Number(draft.assemblyId) },
      { fieldId: Fields.QUANTITY, value: draft.quantity },
      ...defaultsToFields(wo.defaults),
    ];
    if (draft.subsidiaryId) body.push({ fieldId: Fields.SUBSIDIARY, value: Number(draft.subsidiaryId) });
    if (draft.locationId) body.push({ fieldId: Fields.LOCATION, value: Number(draft.locationId) });
    if (draft.sourceId) body.push({ fieldId: wo.sourceField, value: Number(draft.sourceId) });
    if (draft.memo) body.push({ fieldId: Fields.MEMO, value: draft.memo });

    return String(new RecordWriter(wo.recordType).write(body));
  }

  // ─── SalesSource ─────────────────────────────────────────────
  listSales(date: string): { lines: SaleLine[]; transactions: number } {
    const s = this.config.sales;
    const rows = runSearch(
      s.recordType,
      [
        { name: 'trandate', operator: 'on', values: date },
        { name: 'mainline', operator: 'is', values: 'F' },
        { name: 'taxline', operator: 'is', values: 'F' },
      ],
      Object.entries(s.columns).map(([label, name]) => ({ name, label }))
    );
    return { lines: rows.map(rowToSaleLine), transactions: new Set(rows.map((r) => r.id)).size };
  }
}

// ─── Row mappers (exported for tests) ──────────────────────────

type Cell = SearchResultRow['values'][string] | undefined;

function raw(v: Cell): string {
  if (v === undefined) return '';
  return typeof v === 'string' ? v : v.value;
}
function text(v: Cell): string {
  if (v === undefined) return '';
  return typeof v === 'string' ? v : v.text || v.value;
}
function num(v: Cell): number | undefined {
  const r = raw(v);
  if (r === '') return undefined;
  const n = Number(r);
  return Number.isFinite(n) ? n : undefined;
}

export function rowToSnapshot(row: SearchResultRow): StockSnapshot {
  const v = row.values;
  return {
    itemId: row.id,
    name: text(v['name']),
    available: num(v['available']) ?? 0,
    onOrder: num(v['onorder']) ?? 0,
    dailyDemand: num(v['demand']) ?? 0,
    reorderPoint: num(v['reorderpoint']),
    preferredStockLevel: num(v['preferred']),
    leadTimeDays: num(v['leadtime']),
    vendorId: raw(v['vendor']) || undefined,
  };
}

export function rowToSaleLine(row: SearchResultRow): SaleLine {
  const v = row.values;
  return {
    itemId: raw(v['item']),
    itemName: text(v['item']),
    quantity: num(v['quantity']) ?? 0,
    amount: num(v['amount']) ?? 0,
    paymentMethod: (typeof v['payment'] === 'string' ? v['payment'] : text(v['payment'])) || 'other',
  };
}
