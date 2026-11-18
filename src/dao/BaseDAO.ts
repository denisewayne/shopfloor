/**
 * Base Data Access Object (DAO) for NetSuite records.
 *
 * Encapsulates N/record CRUD so scripts and services never call
 * record.load / record.create directly. Each domain entity gets
 * a concrete DAO subclass that adds field mappings and validation.
 */
import * as record from 'N/record';
import { InternalId } from '../types';
import { RecordNotFoundError } from '../utils/errors';
import { Logger } from '../utils/logger';

export interface FieldMapping {
  fieldId: string;
  value: string | number | boolean | null;
  isText?: boolean;
}

export interface SublistLineMapping {
  sublistId: string;
  fields: FieldMapping[];
}

export abstract class BaseDAO {
  protected abstract readonly recordType: string;

  /**
   * Load a record by internal ID.
   */
  load(id: InternalId, isDynamic = false): record.Record {
    try {
      return record.load({
        type: this.recordType,
        id: Number(id),
        isDynamic,
      });
    } catch (e) {
      Logger.error('DAO load failed', e as Error);
      throw new RecordNotFoundError(this.recordType, String(id));
    }
  }

  /**
   * Create a new record with body fields and optional sublist lines.
   */
  create(
    fields: FieldMapping[],
    sublistLines?: SublistLineMapping[],
    isDynamic = false
  ): number {
    const rec = record.create({
      type: this.recordType,
      isDynamic,
    });

    this.setFields(rec, fields);

    if (sublistLines) {
      for (const sl of sublistLines) {
        for (const lineFields of [sl.fields]) {
          this.insertSublistLine(rec, sl.sublistId, lineFields, isDynamic);
        }
      }
    }

    const id = rec.save({ enableSourcing: true, ignoreMandatoryFields: false });
    Logger.audit('Record created', { type: this.recordType, id: String(id) } as unknown as string);
    return id as number;
  }

  /**
   * Update body fields on an existing record.
   */
  update(id: InternalId, fields: FieldMapping[]): number {
    const rec = this.load(id);
    this.setFields(rec, fields);
    const savedId = rec.save({ enableSourcing: true, ignoreMandatoryFields: false });
    Logger.audit('Record updated', { type: this.recordType, id: String(savedId) } as unknown as string);
    return savedId as number;
  }

  /**
   * Delete a record by internal ID.
   */
  remove(id: InternalId): void {
    record.delete({ type: this.recordType, id: Number(id) });
    Logger.audit('Record deleted', { type: this.recordType, id: String(id) } as unknown as string);
  }

  /**
   * Submit individual fields without loading the full record (lighter governance).
   */
  submitFields(id: InternalId, fields: FieldMapping[]): void {
    const values: Record<string, string | number | boolean> = {};
    for (const f of fields) {
      if (f.value !== null) {
        values[f.fieldId] = f.value;
      }
    }
    record.submitFields({
      type: this.recordType,
      id: Number(id),
      values,
    });
    Logger.debug('Fields submitted', { type: this.recordType, id: String(id) } as unknown as string);
  }

  // ─── Protected helpers ───────────────────────────────────────

  protected setFields(rec: record.Record, fields: FieldMapping[]): void {
    for (const f of fields) {
      if (f.value === null) continue;
      if (f.isText) {
        rec.setText({ fieldId: f.fieldId, text: String(f.value) });
      } else {
        rec.setValue({ fieldId: f.fieldId, value: f.value });
      }
    }
  }

  protected insertSublistLine(
    rec: record.Record,
    sublistId: string,
    fields: FieldMapping[],
    isDynamic: boolean
  ): void {
    if (isDynamic) {
      rec.selectNewLine({ sublistId });
      for (const f of fields) {
        if (f.value === null) continue;
        rec.setCurrentSublistValue({
          sublistId,
          fieldId: f.fieldId,
          value: f.value,
        });
      }
      rec.commitLine({ sublistId });
    } else {
      const lineCount = rec.getLineCount({ sublistId });
      for (const f of fields) {
        if (f.value === null) continue;
        rec.setSublistValue({
          sublistId,
          fieldId: f.fieldId,
          value: f.value,
          line: lineCount,
        });
      }
    }
  }
}
