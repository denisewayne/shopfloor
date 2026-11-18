/**
 * Customer DAO — concrete record access for customer records.
 */
import { BaseDAO, FieldMapping } from './BaseDAO';
import { RecordType } from '../constants';
import { CustomerData } from '../types';
import { ValidationError } from '../utils/errors';

export class CustomerDAO extends BaseDAO {
  protected readonly recordType = RecordType.CUSTOMER;

  createFromData(data: CustomerData): number {
    this.validate(data);

    const fields: FieldMapping[] = [
      { fieldId: 'companyname', value: data.companyName },
      { fieldId: 'subsidiary', value: Number(data.subsidiary) },
    ];

    if (data.email) fields.push({ fieldId: 'email', value: data.email });
    if (data.phone) fields.push({ fieldId: 'phone', value: data.phone });
    if (data.externalId) fields.push({ fieldId: 'externalid', value: data.externalId });
    if (data.category) fields.push({ fieldId: 'category', value: Number(data.category) });

    if (data.customFields) {
      for (const [key, val] of Object.entries(data.customFields)) {
        fields.push({ fieldId: key, value: val as string | number | boolean });
      }
    }

    return this.create(fields);
  }

  private validate(data: CustomerData): void {
    if (!data.companyName) throw new ValidationError('Company name is required', 'companyName');
    if (!data.subsidiary) throw new ValidationError('Subsidiary is required', 'subsidiary');
  }
}
