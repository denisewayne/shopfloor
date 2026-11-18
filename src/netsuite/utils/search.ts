/**
 * Search helper — wraps N/search with pagination, governance checks,
 * and typed result mapping.
 *
 * All data access should go through these helpers or the DAO layer,
 * never raw search.create() calls in script entry points.
 */
import * as search from 'N/search';
import { Governance } from '../constants/index';
import { SearchFilter, SearchColumnDef, SearchResultRow } from '../types/index';
import { shouldYield } from './governance';
import { Logger } from './logger';

/**
 * Run a saved search by ID and return all results (auto-paginates).
 */
export function runSavedSearch(searchId: string): SearchResultRow[] {
  const savedSearch = search.load({ id: searchId });
  return collectResults(savedSearch);
}

/**
 * Create and run an ad-hoc search with typed filters/columns.
 */
export function runSearch(
  recordType: string,
  filters: SearchFilter[],
  columns: SearchColumnDef[]
): SearchResultRow[] {
  const nsFilters = filters.map((f) =>
    search.createFilter({
      name: f.name,
      operator: f.operator as unknown as search.Operator,
      values: Array.isArray(f.values) ? f.values : [f.values],
      join: f.join,
    })
  );

  const nsColumns = columns.map((c) =>
    search.createColumn({
      name: c.name,
      join: c.join,
      summary: c.summary as search.Summary | undefined,
      sort: c.sort === 'ASC'
        ? search.Sort.ASC
        : c.sort === 'DESC'
          ? search.Sort.DESC
          : undefined,
      label: c.label,
    })
  );

  const s = search.create({
    type: recordType,
    filters: nsFilters,
    columns: nsColumns,
  });

  return collectResults(s);
}

/**
 * Lookup a single field value by internal ID.
 */
export function lookupField(
  recordType: string,
  id: string | number,
  fieldId: string
): string {
  const result = search.lookupFields({
    type: recordType,
    id: String(id),
    columns: [fieldId],
  });
  const val = result[fieldId];
  if (Array.isArray(val) && val.length > 0) {
    return (val[0] as { value: string }).value;
  }
  return String(val ?? '');
}

/**
 * Lookup multiple field values by internal ID.
 */
export function lookupFields(
  recordType: string,
  id: string | number,
  fieldIds: string[]
): Record<string, string> {
  const result = search.lookupFields({
    type: recordType,
    id: String(id),
    columns: fieldIds,
  });

  const mapped: Record<string, string> = {};
  for (const fid of fieldIds) {
    const val = result[fid];
    if (Array.isArray(val) && val.length > 0) {
      mapped[fid] = (val[0] as { value: string }).value;
    } else {
      mapped[fid] = String(val ?? '');
    }
  }
  return mapped;
}

// ─── Internal ────────────────────────────────────────────────────

function collectResults(searchObj: search.Search): SearchResultRow[] {
  const results: SearchResultRow[] = [];
  let paged: search.PagedData;

  try {
    paged = searchObj.runPaged({ pageSize: Governance.SEARCH_PAGE_SIZE });
  } catch (e) {
    Logger.error('Search failed', e as Error);
    throw e;
  }

  paged.pageRanges.forEach((range) => {
    if (shouldYield()) {
      Logger.audit('Search pagination halted — governance yield', {
        collected: String(results.length),
      } as unknown as string);
      return;
    }

    const page = paged.fetch({ index: range.index });
    page.data.forEach((result) => {
      const row: SearchResultRow = {
        id: result.id,
        recordType: String(result.recordType),
        values: {},
      };

      searchObj.columns.forEach((col) => {
        const key = (col as search.Column).label || (col as search.Column).name;
        const text = result.getText(col as search.Column);
        const value = result.getValue(col as search.Column);
        row.values[key] = text ? { value: String(value), text } : String(value);
      });

      results.push(row);
    });
  });

  Logger.debug('Search complete', { count: String(results.length) } as unknown as string);
  return results;
}
