/**
 * Sales Order DAO — concrete record access for sales orders.
 */
import { BaseDAO, FieldMapping, SublistLineMapping } from './BaseDAO';
import { RecordType, Fields, Sublists } from '../constants';
import { SalesOrderData } from '../types';
import { ValidationError } from '../utils/errors';

export class SalesOrderDAO extends BaseDAO {
  protected readonly recordType = RecordType.SALES_ORDER;

  /**
   * Create a sales order from a typed data object.
   */
  createFromData(data: SalesOrderData): number {
    this.validate(data);

    const bodyFields: FieldMapping[] = [
      { fieldId: Fields.ENTITY, value: Number(data.entity) },
      { fieldId: 'subsidiary', value: Number(data.subsidiary) },
    ];

    if (data.tranDate) bodyFields.push({ fieldId: Fields.TRAN_DATE, value: data.tranDate });
    if (data.memo) bodyFields.push({ fieldId: Fields.MEMO, value: data.memo });
    if (data.location) bodyFields.push({ fieldId: 'location', value: Number(data.location) });
    if (data.department) bodyFields.push({ fieldId: 'department', value: Number(data.department) });
    if (data.externalId) bodyFields.push({ fieldId: 'externalid', value: data.externalId });

    // Custom fields
    if (data.customFields) {
      for (const [key, val] of Object.entries(data.customFields)) {
        bodyFields.push({ fieldId: key, value: val as string | number | boolean });
      }
    }

    const sublistLines: SublistLineMapping[] = data.items.map((item) => {
      const fields: FieldMapping[] = [
        { fieldId: Fields.ITEM, value: Number(item.item) },
        { fieldId: Fields.QUANTITY, value: item.quantity },
      ];
      if (item.rate !== undefined) fields.push({ fieldId: Fields.RATE, value: item.rate });
      if (item.location) fields.push({ fieldId: 'location', value: Number(item.location) });
      if (item.description) fields.push({ fieldId: 'description', value: item.description });

      if (item.customFields) {
        for (const [key, val] of Object.entries(item.customFields)) {
          fields.push({ fieldId: key, value: val as string | number | boolean });
        }
      }

      return { sublistId: Sublists.ITEM, fields };
    });

    return this.create(bodyFields, sublistLines);
  }

  private validate(data: SalesOrderData): void {
    if (!data.entity) throw new ValidationError('Entity is required', 'entity');
    if (!data.subsidiary) throw new ValidationError('Subsidiary is required', 'subsidiary');
    if (!data.items || data.items.length === 0) {
      throw new ValidationError('At least one line item is required', 'items');
    }
    for (let i = 0; i < data.items.length; i++) {
      const line = data.items[i];
      if (!line.item) throw new ValidationError(`Item is required on line ${i + 1}`, 'item');
      if (!line.quantity || line.quantity <= 0) {
        throw new ValidationError(`Positive quantity required on line ${i + 1}`, 'quantity');
      }
    }
  }
}
