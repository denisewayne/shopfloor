/**
 * Work Order DAO: creates production orders for assembly items.
 * NetSuite sources the component lines from the assembly's BOM on save.
 */
import { BaseDAO, FieldMapping } from './BaseDAO';
import { RecordType, Fields } from '../constants';
import { InternalId } from '../types';
import { ValidationError } from '../utils/errors';

export interface WorkOrderData {
  assemblyItem: InternalId;
  quantity: number;
  subsidiary?: InternalId;
  location?: InternalId;
  /** Link the build to the sales order that needs it. */
  createdFrom?: InternalId;
  memo?: string;
}

export class WorkOrderDAO extends BaseDAO {
  protected readonly recordType = RecordType.WORK_ORDER;

  createFromData(data: WorkOrderData): number {
    if (!data.assemblyItem) throw new ValidationError('Assembly item is required', 'assemblyitem');
    if (!(data.quantity > 0)) throw new ValidationError('Quantity must be positive', 'quantity');

    const body: FieldMapping[] = [
      { fieldId: 'assemblyitem', value: Number(data.assemblyItem) },
      { fieldId: Fields.QUANTITY, value: data.quantity },
    ];
    if (data.subsidiary) body.push({ fieldId: Fields.SUBSIDIARY, value: Number(data.subsidiary) });
    if (data.location) body.push({ fieldId: Fields.LOCATION, value: Number(data.location) });
    if (data.createdFrom) body.push({ fieldId: 'createdfrom', value: Number(data.createdFrom) });
    if (data.memo) body.push({ fieldId: Fields.MEMO, value: data.memo });

    return this.create(body);
  }
}
