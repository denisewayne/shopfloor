/**
 * Purchase Order DAO: creates restock POs from reorder suggestions.
 */
import { BaseDAO, FieldMapping, SublistLineMapping } from './BaseDAO';
import { RecordType, Fields, Sublists } from '../constants';
import { InternalId } from '../types';
import { ValidationError } from '../utils/errors';

export interface PurchaseOrderLine {
  item: InternalId;
  quantity: number;
}

export class PurchaseOrderDAO extends BaseDAO {
  protected readonly recordType = RecordType.PURCHASE_ORDER;

  createForVendor(vendor: InternalId, lines: PurchaseOrderLine[], memo?: string, location?: InternalId): number {
    if (!vendor) throw new ValidationError('Vendor is required', 'entity');
    if (lines.length === 0) throw new ValidationError('At least one line is required', 'items');

    const body: FieldMapping[] = [{ fieldId: Fields.ENTITY, value: Number(vendor) }];
    if (memo) body.push({ fieldId: Fields.MEMO, value: memo });
    if (location) body.push({ fieldId: Fields.LOCATION, value: Number(location) });

    const sublist: SublistLineMapping[] = lines.map((l) => ({
      sublistId: Sublists.ITEM,
      fields: [
        { fieldId: Fields.ITEM, value: Number(l.item) },
        { fieldId: Fields.QUANTITY, value: l.quantity },
      ],
    }));

    return this.create(body, sublist);
  }
}
