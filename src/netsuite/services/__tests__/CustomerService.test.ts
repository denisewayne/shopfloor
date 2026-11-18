/**
 * Tests for CustomerService business logic.
 */
import { CustomerService } from '../../services/CustomerService';
import { CustomerData } from '../../types/index';
import { ValidationError } from '../../utils/errors';
import { _clearLogs } from '../../../../test/__mocks__/N/log';

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(() => {
    service = new CustomerService();
    _clearLogs();
  });

  describe('createCustomer', () => {
    const validCustomer: CustomerData = {
      companyName: 'Acme Corp',
      subsidiary: 1,
      email: 'info@acme.com',
      phone: '555-0100',
    };

    it('creates a customer with valid data', () => {
      const id = service.createCustomer(validCustomer);
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('rejects empty company name', () => {
      expect(() =>
        service.createCustomer({ ...validCustomer, companyName: '' })
      ).toThrow(ValidationError);
    });

    it('rejects whitespace-only company name', () => {
      expect(() =>
        service.createCustomer({ ...validCustomer, companyName: '   ' })
      ).toThrow(ValidationError);
    });

    it('rejects company name over 83 characters', () => {
      const longName = 'A'.repeat(84);
      expect(() =>
        service.createCustomer({ ...validCustomer, companyName: longName })
      ).toThrow(ValidationError);
      expect(() =>
        service.createCustomer({ ...validCustomer, companyName: longName })
      ).toThrow(/83 characters/);
    });

    it('rejects invalid email format', () => {
      expect(() =>
        service.createCustomer({ ...validCustomer, email: 'not-an-email' })
      ).toThrow(ValidationError);
    });

    it('accepts customer without email', () => {
      const noEmail: CustomerData = {
        companyName: 'No Email Inc',
        subsidiary: 1,
      };
      const id = service.createCustomer(noEmail);
      expect(typeof id).toBe('number');
    });
  });

  describe('updateContactInfo', () => {
    it('rejects empty update', () => {
      expect(() => service.updateContactInfo(1)).toThrow(ValidationError);
      expect(() => service.updateContactInfo(1)).toThrow(/No fields to update/);
    });

    it('rejects invalid email on update', () => {
      expect(() =>
        service.updateContactInfo(1, 'bad-email')
      ).toThrow(ValidationError);
    });

    it('accepts valid email update', () => {
      expect(() =>
        service.updateContactInfo(1, 'new@example.com')
      ).not.toThrow();
    });

    it('accepts phone-only update', () => {
      expect(() =>
        service.updateContactInfo(1, undefined, '555-9999')
      ).not.toThrow();
    });
  });
});
