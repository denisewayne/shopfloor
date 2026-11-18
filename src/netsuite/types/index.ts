/**
 * Shared TypeScript types for the NetSuite integration layer.
 *
 * These supplement @hitc/netsuite-types with domain-specific shapes
 * used across scripts, services, and DAOs.
 */

// ─── Generic helpers ─────────────────────────────────────────────

/** Make selected keys required while keeping the rest as-is. */
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** A NetSuite internal ID — always coerce to string for API calls. */
export type InternalId = string | number;

// ─── Search / Query ──────────────────────────────────────────────

export interface SearchFilter {
  name: string;
  operator: string;
  values: string | string[];
  join?: string;
}

export interface SearchColumnDef {
  name: string;
  join?: string;
  summary?: 'GROUP' | 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
  sort?: 'ASC' | 'DESC';
  label?: string;
}

export interface SearchResultRow {
  id: string;
  recordType: string;
  values: Record<string, string | { value: string; text: string }>;
}

// ─── RESTlet ─────────────────────────────────────────────────────

export interface RestletRequest<T = unknown> {
  action?: string;
  payload?: T;
  params?: Record<string, string>;
}

export interface RestletResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

// ─── Map/Reduce ──────────────────────────────────────────────────

export interface MapReduceContext {
  key: string;
  value: string;
}

export interface MapReduceSummary {
  inputSummary: { error: string };
  mapSummary: { errors: { iterator: () => { each: (fn: (key: string, value: string) => boolean) => void } } };
  reduceSummary: { errors: { iterator: () => { each: (fn: (key: string, value: string) => boolean) => void } } };
  output: { iterator: () => { each: (fn: (key: string, value: string) => boolean) => void } };
}

// ─── User Event ──────────────────────────────────────────────────

export type UserEventType = 'create' | 'edit' | 'delete' | 'xedit' | 'approve' | 'reject' | 'cancel' | 'pack' | 'ship' | 'copy' | 'print' | 'email';

export interface UserEventContext {
  newRecord: {
    id: string;
    type: string;
    getValue: (fieldId: string) => string;
    getSublistValue: (options: { sublistId: string; fieldId: string; line: number }) => string;
  };
  oldRecord?: {
    id: string;
    type: string;
    getValue: (fieldId: string) => string;
  };
  type: UserEventType;
}

// ─── Domain Entities ─────────────────────────────────────────────

export interface CustomerData {
  id?: InternalId;
  externalId?: string;
  companyName: string;
  email?: string;
  phone?: string;
  subsidiary: InternalId;
  category?: InternalId;
  customFields?: Record<string, string | number | boolean>;
}

export interface SalesOrderLine {
  item: InternalId;
  quantity: number;
  rate?: number;
  amount?: number;
  location?: InternalId;
  description?: string;
  customFields?: Record<string, string | number | boolean>;
}

export interface SalesOrderData {
  id?: InternalId;
  externalId?: string;
  entity: InternalId;
  subsidiary: InternalId;
  tranDate?: string;
  memo?: string;
  location?: InternalId;
  department?: InternalId;
  items: SalesOrderLine[];
  customFields?: Record<string, string | number | boolean>;
}

// ─── Integration / External ──────────────────────────────────────

export interface IntegrationConfig {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  retryCount?: number;
  headers?: Record<string, string>;
}

export interface WebhookPayload<T = unknown> {
  event: string;
  timestamp: string;
  data: T;
  signature?: string;
}
