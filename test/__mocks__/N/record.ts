/**
 * Mock for N/record — in-memory record manipulation.
 */

const records: Map<string, Map<string, unknown>> = new Map();
let _nextId = 1000;

interface MockRecord {
  id: number;
  type: string;
  values: Map<string, unknown>;
  sublists: Map<string, Array<Map<string, unknown>>>;
  getValue: (options: { fieldId: string }) => unknown;
  setValue: (options: { fieldId: string; value: unknown }) => void;
  setText: (options: { fieldId: string; text: string }) => void;
  getLineCount: (options: { sublistId: string }) => number;
  setSublistValue: (options: { sublistId: string; fieldId: string; value: unknown; line: number }) => void;
  getSublistValue: (options: { sublistId: string; fieldId: string; line: number }) => unknown;
  selectNewLine: (options: { sublistId: string }) => void;
  setCurrentSublistValue: (options: { sublistId: string; fieldId: string; value: unknown }) => void;
  commitLine: (options: { sublistId: string }) => void;
  selectLine: (options: { sublistId: string; line: number }) => void;
  save: (options?: { enableSourcing?: boolean; ignoreMandatoryFields?: boolean }) => number;
}

function createMockRecord(type: string, _isDynamic?: boolean): MockRecord {
  const values = new Map<string, unknown>();
  const sublists = new Map<string, Array<Map<string, unknown>>>();
  const id = _nextId++;

  return {
    id,
    type,
    values,
    sublists,
    getValue: ({ fieldId }) => values.get(fieldId),
    setValue: ({ fieldId, value }) => { values.set(fieldId, value); },
    setText: ({ fieldId, text }) => { values.set(fieldId, text); },
    getLineCount: ({ sublistId }) => (sublists.get(sublistId) || []).length,
    setSublistValue: ({ sublistId, fieldId, value, line }) => {
      if (!sublists.has(sublistId)) sublists.set(sublistId, []);
      const lines = sublists.get(sublistId)!;
      if (!lines[line]) lines[line] = new Map();
      lines[line].set(fieldId, value);
    },
    getSublistValue: ({ sublistId, fieldId, line }) => {
      return sublists.get(sublistId)?.[line]?.get(fieldId);
    },
    selectNewLine: ({ sublistId }) => {
      if (!sublists.has(sublistId)) sublists.set(sublistId, []);
    },
    setCurrentSublistValue: ({ sublistId, fieldId, value }) => {
      const lines = sublists.get(sublistId) || [];
      if (lines.length === 0) lines.push(new Map());
      lines[lines.length - 1].set(fieldId, value);
      sublists.set(sublistId, lines);
    },
    commitLine: ({ sublistId }) => {
      const lines = sublists.get(sublistId) || [];
      lines.push(new Map());
      sublists.set(sublistId, lines);
    },
    selectLine: () => { /* no-op for mock */ },
    save: () => id,
  };
}

export function create(options: { type: string; isDynamic?: boolean }): MockRecord {
  return createMockRecord(options.type, options.isDynamic);
}

export function load(options: { type: string; id: number; isDynamic?: boolean }): MockRecord {
  const rec = createMockRecord(options.type, options.isDynamic);
  (rec as { id: number }).id = options.id;
  return rec;
}

export function submitFields(_options: {
  type: string;
  id: number;
  values: Record<string, unknown>;
}): void {
  // no-op in mock
}

function deleteRecord(options: { type: string; id: number }): void {
  records.delete(`${options.type}:${options.id}`);
}
export { deleteRecord as delete };

/** Test helper: reset state */
export function _reset(): void {
  records.clear();
  _nextId = 1000;
}
