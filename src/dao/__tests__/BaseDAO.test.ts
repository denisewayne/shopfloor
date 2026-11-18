/**
 * Tests for BaseDAO record operations.
 */
import { BaseDAO, FieldMapping } from '../../dao/BaseDAO';
import { _clearLogs } from '../../../test/__mocks__/N/log';

// Concrete subclass for testing the abstract BaseDAO
class TestDAO extends BaseDAO {
  protected readonly recordType = 'customrecord_test';
}

describe('BaseDAO', () => {
  let dao: TestDAO;

  beforeEach(() => {
    dao = new TestDAO();
    _clearLogs();
  });

  describe('create', () => {
    it('returns a numeric internal ID', () => {
      const fields: FieldMapping[] = [
        { fieldId: 'name', value: 'Test Record' },
        { fieldId: 'custrecord_status', value: 'active' },
      ];
      const id = dao.create(fields);
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('skips null-valued fields', () => {
      const fields: FieldMapping[] = [
        { fieldId: 'name', value: 'Test' },
        { fieldId: 'optional_field', value: null },
      ];
      // Should not throw
      const id = dao.create(fields);
      expect(id).toBeGreaterThan(0);
    });
  });

  describe('load', () => {
    it('returns a record object', () => {
      const rec = dao.load(1);
      expect(rec).toBeDefined();
      expect(rec.id).toBe(1);
    });
  });

  describe('update', () => {
    it('returns the saved ID', () => {
      const id = dao.update(1, [{ fieldId: 'name', value: 'Updated' }]);
      expect(typeof id).toBe('number');
    });
  });

  describe('remove', () => {
    it('does not throw for valid IDs', () => {
      expect(() => dao.remove(1)).not.toThrow();
    });
  });

  describe('submitFields', () => {
    it('submits without loading the full record', () => {
      expect(() =>
        dao.submitFields(1, [
          { fieldId: 'name', value: 'Quick Update' },
          { fieldId: 'custrecord_flag', value: true },
        ])
      ).not.toThrow();
    });
  });
});
