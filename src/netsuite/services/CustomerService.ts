/**
 * Customer Service — business logic for customer lifecycle.
 *
 * Handles customer creation with dedup checks, customer lookups,
 * and profile update orchestration.
 */
import { BaseService } from './BaseService';
import { CustomerDAO } from '../dao/CustomerDAO';
import { CustomerData, InternalId, SearchFilter, SearchColumnDef } from '../types/index';
import { RecordType } from '../constants/index';
import { ValidationError } from '../utils/errors';
import { runSearch, lookupFields } from '../utils/search';
import { Logger } from '../utils/logger';

export class CustomerService extends BaseService {
  private readonly dao: CustomerDAO;

  constructor() {
    super('CustomerService');
    this.dao = new CustomerDAO();
  }

  /**
   * Create a customer after checking for duplicates by email.
   */
  createCustomer(data: CustomerData): number {
    return this.execute('createCustomer', () => {
      this.validateCustomerData(data);

      if (data.email) {
        const existing = this.findByEmail(data.email);
        if (existing.length > 0) {
          throw new ValidationError(
            `Customer with email ${data.email} already exists (ID: ${existing[0].id})`,
            'email'
          );
        }
      }

      const id = this.dao.createFromData(data);
      Logger.audit('Customer created', {
        id: String(id),
        name: data.companyName,
      } as unknown as string);
      return id;
    });
  }

  /**
   * Look up a customer's profile fields.
   */
  getProfile(id: InternalId): Record<string, string> {
    return this.execute('getProfile', () => {
      return lookupFields(
        RecordType.CUSTOMER,
        id,
        ['companyname', 'email', 'phone', 'subsidiary', 'category', 'datecreated']
      );
    });
  }

  /**
   * Find customers by email address.
   */
  findByEmail(email: string): Array<{ id: string; name: string }> {
    return this.execute('findByEmail', () => {
      const filters: SearchFilter[] = [
        { name: 'email', operator: 'is', values: email },
      ];
      const columns: SearchColumnDef[] = [
        { name: 'internalid' },
        { name: 'companyname' },
      ];

      const results = runSearch(RecordType.CUSTOMER, filters, columns);
      return results.map((row) => ({
        id: row.id,
        name: extractValue(row.values['companyname']),
      }));
    });
  }

  /**
   * Find customers by name (partial match).
   */
  searchByName(name: string): Array<{ id: string; name: string; email: string }> {
    return this.execute('searchByName', () => {
      const filters: SearchFilter[] = [
        { name: 'companyname', operator: 'contains', values: name },
      ];
      const columns: SearchColumnDef[] = [
        { name: 'internalid' },
        { name: 'companyname' },
        { name: 'email' },
      ];

      const results = runSearch(RecordType.CUSTOMER, filters, columns);
      return results.map((row) => ({
        id: row.id,
        name: extractValue(row.values['companyname']),
        email: extractValue(row.values['email']),
      }));
    });
  }

  /**
   * Update a customer's contact info.
   */
  updateContactInfo(id: InternalId, email?: string, phone?: string): void {
    return this.execute('updateContactInfo', () => {
      const fields: Array<{ fieldId: string; value: string | number | boolean | null }> = [];

      if (email !== undefined) {
        this.validateEmail(email);
        fields.push({ fieldId: 'email', value: email });
      }
      if (phone !== undefined) {
        fields.push({ fieldId: 'phone', value: phone });
      }

      if (fields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      this.dao.submitFields(id, fields);
      Logger.audit('Customer contact updated', { id: String(id) } as unknown as string);
    });
  }

  // ─── Private ─────────────────────────────────────────────────

  private validateCustomerData(data: CustomerData): void {
    if (!data.companyName || data.companyName.trim().length === 0) {
      throw new ValidationError('Company name is required', 'companyName');
    }
    if (data.companyName.length > 83) {
      throw new ValidationError('Company name must be 83 characters or fewer', 'companyName');
    }
    if (data.email) {
      this.validateEmail(data.email);
    }
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError(`Invalid email address: ${email}`, 'email');
    }
  }
}

function extractValue(val: string | { value: string; text: string } | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.text || val.value;
}
