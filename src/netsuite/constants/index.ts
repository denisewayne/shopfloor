/**
 * Core enumerations and constants used across NetSuite integrations.
 *
 * NetSuite record types, sublists, field IDs, and custom segment values
 * live here so scripts reference symbols instead of magic strings.
 */

// ─── Record Types ────────────────────────────────────────────────
export enum RecordType {
  SALES_ORDER = 'salesorder',
  PURCHASE_ORDER = 'purchaseorder',
  INVOICE = 'invoice',
  CUSTOMER = 'customer',
  VENDOR = 'vendor',
  ITEM_FULFILLMENT = 'itemfulfillment',
  ITEM_RECEIPT = 'itemreceipt',
  INVENTORY_ITEM = 'inventoryitem',
  JOURNAL_ENTRY = 'journalentry',
  CUSTOM_RECORD = 'customrecord',
  EMPLOYEE = 'employee',
  CREDIT_MEMO = 'creditmemo',
  CASH_SALE = 'cashsale',
  ESTIMATE = 'estimate',
  OPPORTUNITY = 'opportunity',
  TRANSFER_ORDER = 'transferorder',
  WORK_ORDER = 'workorder',
}

// ─── Transaction Statuses ────────────────────────────────────────
export enum TransactionStatus {
  PENDING_APPROVAL = 'pendingApproval',
  PENDING_FULFILLMENT = 'pendingFulfillment',
  PARTIALLY_FULFILLED = 'partiallyFulfilled',
  PENDING_BILLING = 'pendingBilling',
  BILLED = 'billed',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// ─── Script Execution Context ────────────────────────────────────
export enum ExecutionContext {
  USER_INTERFACE = 'userinterface',
  CSV_IMPORT = 'csvimport',
  WEB_SERVICES = 'webservices',
  SUITELET = 'suitelet',
  RESTLET = 'restlet',
  SCHEDULED = 'scheduled',
  MAP_REDUCE = 'mapreduce',
  WORKFLOW = 'workflow',
  USER_EVENT = 'userevent',
}

// ─── Common Field IDs ────────────────────────────────────────────
export const Fields = {
  INTERNAL_ID: 'internalid',
  EXTERNAL_ID: 'externalid',
  NAME: 'name',
  ENTITY: 'entity',
  SUBSIDIARY: 'subsidiary',
  LOCATION: 'location',
  DEPARTMENT: 'department',
  CLASS: 'class',
  MEMO: 'memo',
  TRAN_DATE: 'trandate',
  TRAN_ID: 'tranid',
  STATUS: 'status',
  TOTAL: 'total',
  ITEM: 'item',
  QUANTITY: 'quantity',
  RATE: 'rate',
  AMOUNT: 'amount',
  LINE: 'line',
} as const;

// ─── Sublist IDs ─────────────────────────────────────────────────
export const Sublists = {
  ITEM: 'item',
  EXPENSE: 'expense',
  APPLY: 'apply',
  ADDRESS: 'addressbook',
  PARTNERS: 'partners',
  LINE: 'line',
} as const;

// ─── Governance Thresholds ───────────────────────────────────────
export const Governance = {
  /** Remaining-usage floor before yielding in scheduled/MR scripts */
  YIELD_THRESHOLD: 100,
  /** Max search page size */
  SEARCH_PAGE_SIZE: 1000,
  /** Max lines in a single sublist commit */
  SUBLIST_COMMIT_BATCH: 500,
} as const;
