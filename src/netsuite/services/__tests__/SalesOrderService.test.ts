/**
 * Tests for SalesOrderService business logic.
 */
import { SalesOrderService } from '../../services/SalesOrderService';
import { SalesOrderData } from '../../types/index';
import { ValidationError } from '../../utils/errors';
import { _clearLogs } from '../../../../test/__mocks__/N/log';

describe('SalesOrderService', () => {
  let service: SalesOrderService;

  beforeEach(() => {
    service = new SalesOrderService();
    _clearLogs();
  });

  describe('createOrder', () => {
    const validOrder: SalesOrderData = {
      entity: 123,
      subsidiary: 1,
      items: [
        { item: 456, quantity: 10, rate: 25 },
        { item: 789, quantity: 5, rate: 50 },
      ],
    };

    it('creates an order with valid data', () => {
      const id = service.createOrder(validOrder);
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('rejects orders with zero total', () => {
      const zeroOrder: SalesOrderData = {
        entity: 123,
        subsidiary: 1,
        items: [{ item: 456, quantity: 1, rate: 0 }],
      };
      expect(() => service.createOrder(zeroOrder)).toThrow(ValidationError);
    });

    it('rejects orders with no line items', () => {
      const emptyOrder: SalesOrderData = {
        entity: 123,
        subsidiary: 1,
        items: [],
      };
      // The DAO-level validation catches this before business rules
      expect(() => service.createOrder(emptyOrder)).toThrow();
    });

    it('rejects orders with negative quantity', () => {
      const badOrder: SalesOrderData = {
        entity: 123,
        subsidiary: 1,
        items: [{ item: 456, quantity: -5, rate: 25 }],
      };
      expect(() => service.createOrder(badOrder)).toThrow(ValidationError);
    });

    it('rejects orders with more than 500 lines', () => {
      const lines = Array.from({ length: 501 }, (_, i) => ({
        item: i + 1,
        quantity: 1,
        rate: 10,
      }));
      const bigOrder: SalesOrderData = {
        entity: 123,
        subsidiary: 1,
        items: lines,
      };
      expect(() => service.createOrder(bigOrder)).toThrow(ValidationError);
      expect(() => service.createOrder(bigOrder)).toThrow(/500 line items/);
    });
  });

  describe('bulkUpdateMemo', () => {
    it('returns success/failure counts', () => {
      const result = service.bulkUpdateMemo([1, 2, 3], 'Updated memo');
      // With mocks, all succeed
      expect(result.succeeded + result.failed).toBe(3);
    });

    it('handles empty array', () => {
      const result = service.bulkUpdateMemo([], 'No orders');
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});

describe('SalesOrderService with business profiles', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getProfile } = require('../../../core/profiles/index');

  it('enforces the manufacturing minimum order total', () => {
    const svc = new SalesOrderService(getProfile('manufacturing'));
    expect(() => svc.createOrder({ entity: 1, subsidiary: 1, items: [{ item: 1, quantity: 1, rate: 20 }] })).toThrow(/minimum of 50/);
    expect(svc.createOrder({ entity: 1, subsidiary: 1, items: [{ item: 1, quantity: 3, rate: 20 }] })).toEqual(expect.any(Number));
  });

  it('enforces the retail line cap', () => {
    const items = Array.from({ length: 201 }, (_, i) => ({ item: i + 1, quantity: 1, rate: 1 }));
    expect(() => new SalesOrderService(getProfile('retail')).createOrder({ entity: 1, subsidiary: 1, items })).toThrow(/200 line items/);
  });
});
