/**
 * Mock for N/search — basic search mock for testing.
 */

export enum Operator {
  ANYOF = 'anyof',
  IS = 'is',
  CONTAINS = 'contains',
  ISNOTEMPTY = 'isnotempty',
  GREATERTHAN = 'greaterthan',
  LESSTHAN = 'lessthan',
}

export enum Sort {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum Summary {
  GROUP = 'GROUP',
  SUM = 'SUM',
  COUNT = 'COUNT',
}

export interface Column {
  name: string;
  join?: string;
  label?: string;
}

export interface Search {
  columns: Column[];
  runPaged: (options: { pageSize: number }) => PagedData;
}

export interface PagedData {
  pageRanges: Array<{ index: number }>;
  fetch: (options: { index: number }) => PageData;
}

export interface PageData {
  data: SearchResult[];
}

export interface SearchResult {
  id: string;
  recordType: string;
  getValue: (col: Column) => string;
  getText: (col: Column) => string;
}

let _mockResults: SearchResult[] = [];

export function createFilter(_options: {
  name: string;
  operator: Operator | string;
  values: string[];
  join?: string;
}): unknown {
  return _options;
}

export function createColumn(options: {
  name: string;
  join?: string;
  summary?: string;
  sort?: Sort;
  label?: string;
}): Column {
  return { name: options.name, join: options.join, label: options.label };
}

export function create(options: {
  type: string;
  filters: unknown[];
  columns: Column[];
}): Search {
  return {
    columns: options.columns,
    runPaged: () => ({
      pageRanges: _mockResults.length > 0 ? [{ index: 0 }] : [],
      fetch: () => ({ data: _mockResults }),
    }),
  };
}

export function load(_options: { id: string }): Search {
  return create({ type: '', filters: [], columns: [] });
}

export function lookupFields(_options: {
  type: string;
  id: string;
  columns: string[];
}): Record<string, unknown> {
  return {};
}

/** Test helper: set mock results */
export function _setMockResults(results: SearchResult[]): void {
  _mockResults = results;
}
