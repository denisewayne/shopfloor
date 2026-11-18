/**
 * In-memory back end. Implements every port with plain arrays so you can
 * run Shopfloor with no ERP at all: unit tests, demos, or a CSV import
 * that loads data into memory first.
 */
import { StockSnapshot } from '../../domain/inventory';
import { SaleLine } from '../../domain/retail';
import {
  Id,
  PurchaseOrderDraft,
  PurchaseOrderWriter,
  SalesSource,
  StockSource,
  WorkOrderDraft,
  WorkOrderWriter,
} from '../../ports/index';

export interface MemorySale extends SaleLine {
  date: string;
  transactionId: Id;
}

export class MemoryBackend implements StockSource, PurchaseOrderWriter, WorkOrderWriter, SalesSource {
  stock: StockSnapshot[] = [];
  sales: MemorySale[] = [];
  readonly purchaseOrders: Array<PurchaseOrderDraft & { id: Id }> = [];
  readonly workOrders: Array<WorkOrderDraft & { id: Id }> = [];
  private nextId = 1;

  constructor(seed: { stock?: StockSnapshot[]; sales?: MemorySale[] } = {}) {
    this.stock = seed.stock ?? [];
    this.sales = seed.sales ?? [];
  }

  listStock(): StockSnapshot[] {
    return this.stock.map((s) => ({ ...s }));
  }

  createPurchaseOrder(draft: PurchaseOrderDraft): Id {
    const id = `PO-${this.nextId++}`;
    this.purchaseOrders.push({ ...draft, id });
    return id;
  }

  createWorkOrder(draft: WorkOrderDraft): Id {
    const id = `WO-${this.nextId++}`;
    this.workOrders.push({ ...draft, id });
    return id;
  }

  listSales(date: string): { lines: SaleLine[]; transactions: number } {
    const day = this.sales.filter((s) => s.date === date);
    return {
      lines: day.map(({ date: _d, transactionId: _t, ...line }) => line),
      transactions: new Set(day.map((s) => s.transactionId)).size,
    };
  }
}
