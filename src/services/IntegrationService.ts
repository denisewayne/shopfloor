/**
 * Integration Service — orchestrates outbound calls to external systems.
 *
 * Manages configuration, payload transformation, webhook dispatch,
 * and response mapping. Sits between afterSubmit hooks / scheduled
 * scripts and the HTTP utility layer.
 */
import { BaseService } from './BaseService';
import { IntegrationConfig, WebhookPayload } from '../types';
import * as http from '../utils/http';
import { IntegrationError, ValidationError } from '../utils/errors';
import { Logger } from '../utils/logger';

interface SyncResult<T = unknown> {
  success: boolean;
  externalId?: string;
  response?: T;
  error?: string;
}

export class IntegrationService extends BaseService {
  private readonly config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    super('IntegrationService');
    this.config = config;
  }

  /**
   * Push a record payload to an external system (POST).
   */
  pushRecord<T = unknown>(entityType: string, payload: unknown): SyncResult<T> {
    return this.execute('pushRecord', () => {
      if (!payload) {
        throw new ValidationError('Payload is required for pushRecord');
      }

      try {
        const response = http.post<T>(this.config, `/api/${entityType}`, payload);

        Logger.audit('Record pushed to external system', {
          entityType,
          statusCode: String(response.statusCode),
        } as unknown as string);

        return {
          success: true,
          response: response.body,
        };
      } catch (e) {
        const err = e as IntegrationError;
        Logger.error('Push failed', err);
        return {
          success: false,
          error: err.message,
        };
      }
    });
  }

  /**
   * Pull a record from an external system by external ID (GET).
   */
  pullRecord<T = unknown>(entityType: string, externalId: string): SyncResult<T> {
    return this.execute('pullRecord', () => {
      try {
        const response = http.get<T>(this.config, `/api/${entityType}/${externalId}`);

        return {
          success: true,
          externalId,
          response: response.body,
        };
      } catch (e) {
        const err = e as IntegrationError;
        return {
          success: false,
          externalId,
          error: err.message,
        };
      }
    });
  }

  /**
   * Dispatch a webhook notification to the configured endpoint.
   */
  sendWebhook<T = unknown>(event: string, data: T): SyncResult {
    return this.execute('sendWebhook', () => {
      const payload: WebhookPayload<T> = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      try {
        const response = http.post(this.config, '/webhooks', payload);

        Logger.audit('Webhook dispatched', {
          event,
          statusCode: String(response.statusCode),
        } as unknown as string);

        return { success: true };
      } catch (e) {
        Logger.error('Webhook dispatch failed', e as Error);
        return {
          success: false,
          error: (e as Error).message,
        };
      }
    });
  }

  /**
   * Health check against the external endpoint.
   */
  healthCheck(): { healthy: boolean; latencyMs?: number; error?: string } {
    return this.execute('healthCheck', () => {
      const start = Date.now();
      try {
        http.get(this.config, '/health');
        return {
          healthy: true,
          latencyMs: Date.now() - start,
        };
      } catch (e) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: (e as Error).message,
        };
      }
    });
  }
}
