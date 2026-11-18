/**
 * Sales Order Service — business logic for sales order lifecycle.
 *
 * Orchestrates SalesOrderDAO, validation rules, status transitions,
 * fulfillment workflows, and external system notifications.
 */
import { BaseService } from './BaseService';
import { SalesOrderDAO } from '../dao/SalesOrderDAO';
import { SalesOrderData, InternalId, SearchFilter, SearchColumnDef } from '../types/index';
import { RecordType, Fields, Sublists, TransactionStatus } from '../constants/index';
import { ValidationError } from '../utils/errors';
import { runSearch, lookupFields } from '../utils/search';
import { Logger } from '../utils/logger';
import { BusinessProfile, getProfile } from '../../core/profiles/index';

export class SalesOrderService extends BaseService {
  private readonly dao: SalesOrderDAO;
  private readonly profile: BusinessProfile;

  constructor(profile: BusinessProfile = getProfile()) {
    super('SalesOrderService');
    this.dao = new SalesOrderDAO();
    this.profile = profile;
  }

  /**
   * Create a sales order with full business rule validation.
   */
  createOrder(data: SalesOrderData): number {
    return this.execute('createOrder', () => {
      this.validateBusinessRules(data);
      const id = this.dao.createFromData(data);
      Logger.audit('Sales order created', { id: String(id) } as unknown as string);
      return id;
    });
  }

  /**
   * Load a sales order and return its header fields.
   */
  getOrderSummary(id: InternalId): Record<string, string> {
    return this.execute('getOrderSummary', () => {
      return lookupFields(
        RecordType.SALES_ORDER,
        id,
        [Fields.TRAN_ID, Fields.ENTITY, Fields.STATUS, Fields.TOTAL, Fields.MEMO, Fields.TRAN_DATE]
      );
    });
  }

  /**
   * Find sales orders by status.
   */
  findByStatus(status: TransactionStatus): Array<{ id: string; tranId: string; entity: string; total: string }> {
    return this.execute('findByStatus', () => {
      const filters: SearchFilter[] = [
        { name: 'status', operator: 'anyof', values: statusToSearchValue(status) },
        { name: 'mainline', operator: 'is', values: 'T' },
      ];

      const columns: SearchColumnDef[] = [
        { name: 'internalid' },
        { name: 'tranid' },
        { name: 'entity' },
        { name: 'total' },
      ];

      const results = runSearch(RecordType.SALES_ORDER, filters, columns);

      return results.map((row) => ({
        id: row.id,
        tranId: extractValue(row.values['tranid']),
        entity: extractValue(row.values['entity']),
        total: extractValue(row.values['total']),
      }));
    });
  }

  /**
   * Close a sales order — sets status and records the reason.
   */
  closeOrder(id: InternalId, reason: string): void {
    return this.execute('closeOrder', () => {
      if (!reason || reason.trim().length === 0) {
        throw new ValidationError('Close reason is required', 'reason');
      }

      const rec = this.dao.load(id, true);
      const currentStatus = rec.getValue({ fieldId: Fields.STATUS }) as string;

      if (currentStatus === 'Closed') {
        throw new ValidationError('Order is already closed');
      }

      // Close all open lines
      const lineCount = rec.getLineCount({ sublistId: Sublists.ITEM });
      for (let i = 0; i < lineCount; i++) {
        rec.selectLine({ sublistId: Sublists.ITEM, line: i });
        rec.setCurrentSublistValue({
          sublistId: Sublists.ITEM,
          fieldId: 'isclosed',
          value: true,
        });
        rec.commitLine({ sublistId: Sublists.ITEM });
      }

      rec.setValue({ fieldId: Fields.MEMO, value: `Closed: ${reason}` });
      rec.save({ enableSourcing: true, ignoreMandatoryFields: false });

      Logger.audit('Sales order closed', { id: String(id), reason } as unknown as string);
    });
  }

  /**
   * Bulk-update memo on multiple orders. Returns counts of success/failure.
   */
  bulkUpdateMemo(
    orderIds: InternalId[],
    memo: string
  ): { succeeded: number; failed: number; errors: Array<{ id: InternalId; message: string }> } {
    return this.execute('bulkUpdateMemo', () => {
      const result = { succeeded: 0, failed: 0, errors: [] as Array<{ id: InternalId; message: string }> };

      for (const id of orderIds) {
        try {
          this.dao.submitFields(id, [{ fieldId: Fields.MEMO, value: memo }]);
          result.succeeded++;
        } catch (e) {
          result.failed++;
          result.errors.push({ id, message: (e as Error).message });
        }
      }

      Logger.audit('Bulk memo update', {
        total: String(orderIds.length),
        succeeded: String(result.succeeded),
        failed: String(result.failed),
      } as unknown as string);

      return result;
    });
  }

  // ─── Private ─────────────────────────────────────────────────

  private validateBusinessRules(data: SalesOrderData): void {
    // Business rule: minimum order value
    const lineTotal = data.items.reduce((sum, line) => {
      const amount = line.amount ?? (line.quantity * (line.rate ?? 0));
      return sum + amount;
    }, 0);

    if (lineTotal <= 0) {
      throw new ValidationError('Order total must be greater than zero');
    }

    // Business rule: profile minimum order value
    if (lineTotal < this.profile.orders.minOrderTotal) {
      throw new ValidationError(
        `Order total ${lineTotal} is below the ${this.profile.id} minimum of ${this.profile.orders.minOrderTotal}`
      );
    }

    // Business rule: profile line cap
    if (data.items.length > this.profile.orders.maxLines) {
      throw new ValidationError(`Orders cannot exceed ${this.profile.orders.maxLines} line items`);
    }

    // Business rule: all items must have positive quantities
    for (let i = 0; i < data.items.length; i++) {
      if (data.items[i].quantity <= 0) {
        throw new ValidationError(`Line ${i + 1}: quantity must be positive`, 'quantity');
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function statusToSearchValue(status: TransactionStatus): string {
  const map: Record<string, string> = {
    [TransactionStatus.PENDING_FULFILLMENT]: 'SalesOrd:B',
    [TransactionStatus.PENDING_APPROVAL]: 'SalesOrd:A',
    [TransactionStatus.PENDING_BILLING]: 'SalesOrd:D',
    [TransactionStatus.PARTIALLY_FULFILLED]: 'SalesOrd:E',
    [TransactionStatus.BILLED]: 'SalesOrd:G',
    [TransactionStatus.CLOSED]: 'SalesOrd:H',
    [TransactionStatus.CANCELLED]: 'SalesOrd:C',
  };
  return map[status] ?? status;
}

function extractValue(val: string | { value: string; text: string } | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.text || val.value;
}
