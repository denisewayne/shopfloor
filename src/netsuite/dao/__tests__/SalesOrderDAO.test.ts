/**
 * Tests for SalesOrderDAO validation and record creation.
 */
import { SalesOrderDAO } from '../../dao/SalesOrderDAO';
import { SalesOrderData } from '../../types/index';
import { ValidationError } from '../../utils/errors';
import { _clearLogs } from '../../../../test/__mocks__/N/log';

describe('SalesOrderDAO', () => {
  let dao: SalesOrderDAO;

  beforeEach(() => {
    dao = new SalesOrderDAO();
    _clearLogs();
  });

  describe('createFromData', () => {
    it('creates a sales order from valid data', () => {
      const data: SalesOrderData = {
        entity: 100,
        subsidiary: 1,
        items: [
          { item: 200, quantity: 5, rate: 10.0 },
        ],
      };
      const id = dao.createFromData(data);
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('creates with all optional fields', () => {
      const data: SalesOrderData = {
        entity: 100,
        subsidiary: 1,
        externalId: 'EXT-001',
        tranDate: '2024-01-15',
        memo: 'Test order',
        location: 5,
        department: 3,
        items: [
          { item: 200, quantity: 5, rate: 10.0, location: 5, description: 'Widget' },
        ],
        customFields: { custbody_source: 'API' },
      };
      const id = dao.createFromData(data);
      expect(id).toBeGreaterThan(0);
    });

    it('throws on missing entity', () => {
      const data = {
        entity: 0,
        subsidiary: 1,
        items: [{ item: 200, quantity: 5 }],
      } as SalesOrderData;
      expect(() => dao.createFromData(data)).toThrow(ValidationError);
    });

    it('throws on missing subsidiary', () => {
      const data = {
        entity: 100,
        subsidiary: 0,
        items: [{ item: 200, quantity: 5 }],
      } as SalesOrderData;
      expect(() => dao.createFromData(data)).toThrow(ValidationError);
    });

    it('throws on empty items array', () => {
      const data: SalesOrderData = {
        entity: 100,
        subsidiary: 1,
        items: [],
      };
      expect(() => dao.createFromData(data)).toThrow(ValidationError);
    });

    it('throws on zero quantity', () => {
      const data: SalesOrderData = {
        entity: 100,
        subsidiary: 1,
        items: [{ item: 200, quantity: 0 }],
      };
      expect(() => dao.createFromData(data)).toThrow(ValidationError);
    });

    it('throws on negative quantity', () => {
      const data: SalesOrderData = {
        entity: 100,
        subsidiary: 1,
        items: [{ item: 200, quantity: -3 }],
      };
      expect(() => dao.createFromData(data)).toThrow(ValidationError);
    });
  });
});
