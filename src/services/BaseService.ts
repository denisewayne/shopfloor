/**
 * Base service class — shared patterns for business logic orchestration.
 *
 * Services sit between script entry points and DAOs. They own business
 * rules, multi-record transactions, and cross-cutting orchestration.
 * Scripts call services; services call DAOs and utils.
 */
import { Logger } from '../utils/logger';
import { NetSuiteError } from '../utils/errors';

export abstract class BaseService {
  protected readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Wrap a service operation with structured logging and error handling.
   * Every public service method should delegate through this.
   */
  protected execute<T>(operation: string, fn: () => T): T {
    Logger.debug(`${this.serviceName}.${operation}`, 'started');

    try {
      const result = fn();
      Logger.audit(`${this.serviceName}.${operation}`, 'completed');
      return result;
    } catch (e) {
      const err = e as Error;
      Logger.error(`${this.serviceName}.${operation}`, err);

      if (err instanceof NetSuiteError) {
        throw err;
      }

      throw new NetSuiteError(
        'SERVICE_ERROR',
        `${this.serviceName}.${operation} failed: ${err.message}`
      );
    }
  }
}
