/**
 * RESTlet entry point — the standard pattern for external API access.
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import { Logger } from '../../utils/logger';
import { RestletRequest, RestletResponse } from '../../types/index';
import { NetSuiteError, ValidationError } from '../../utils/errors';
import { BuildRequest } from '../../../core/services/index';
import { shopfloor } from '../../adapter/runtime';

/**
 * Route-based RESTlet: dispatch by `action` field in the request body.
 * Add handlers to the `routes` map below.
 */
type RouteHandler = (payload: unknown) => unknown;

const routes: Record<string, RouteHandler> = {
  // Register action handlers here:
  // 'getSalesOrder': (payload) => salesOrderService.get(payload),
  // 'createCustomer': (payload) => customerService.create(payload),
  ping: () => ({ message: 'pong', timestamp: new Date().toISOString() }),

  /** Which business profile this deployment runs with. */
  profile: () => shopfloor().profile,

  /** Inventory: list restock suggestions without creating anything. */
  reorderPreview: () => shopfloor().inventory.plan(),

  /** Manufacturing: plan a build and (unless dryRun) create the work order. */
  scheduleBuild: (payload) => {
    const p = (payload ?? {}) as BuildRequest & { dryRun?: boolean; blockOnShortage?: boolean };
    if (!p.assemblyId) throw new ValidationError('assemblyId is required', 'assemblyId');
    return shopfloor().production.scheduleBuild(
      { ...p, bom: p.bom ?? [], componentStock: p.componentStock ?? {} },
      { dryRun: p.dryRun, blockOnShortage: p.blockOnShortage }
    );
  },

  /** Retail: close out a day with the counted cash from the register. */
  closeDay: (payload) => {
    const p = (payload ?? {}) as { date?: string; countedCash?: number };
    if (!p.date) throw new ValidationError('date is required', 'date');
    return shopfloor().retail.closeDay(p.date, p.countedCash ?? null);
  },
};

// ─── Entry Points ────────────────────────────────────────────────

export const get: EntryPoints.RESTlet.get = (
  requestParams: Record<string, string>
): RestletResponse => {
  return handleRequest({ action: requestParams.action, params: requestParams });
};

export const post: EntryPoints.RESTlet.post = (
  requestBody: string | Record<string, unknown>
): RestletResponse => {
  return handleRequest(parseBody(requestBody));
};

export const put: EntryPoints.RESTlet.put = (
  requestBody: string | Record<string, unknown>
): RestletResponse => {
  return handleRequest(parseBody(requestBody));
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const delete_: EntryPoints.RESTlet.delete_ = (
  requestParams: Record<string, string>
): RestletResponse => {
  return handleRequest({ action: requestParams.action, params: requestParams });
};

/**
 * NetSuite passes the body as an object for application/json requests and as
 * a raw string otherwise. Normalize both into a RestletRequest.
 */
function parseBody(body: string | Record<string, unknown>): RestletRequest {
  if (typeof body !== 'string') return body as RestletRequest;
  try {
    return JSON.parse(body) as RestletRequest;
  } catch {
    return {};
  }
}

// ─── Router ──────────────────────────────────────────────────────

function handleRequest(request: RestletRequest): RestletResponse {
  const action = request.action;

  Logger.audit('RESTlet invoked', { action: action ?? 'none' } as unknown as string);

  try {
    if (!action) {
      throw new ValidationError('Missing required field: action');
    }

    const handler = routes[action];
    if (!handler) {
      throw new ValidationError(`Unknown action: ${action}`);
    }

    const data = handler(request.payload);

    return {
      success: true,
      data,
    };
  } catch (e) {
    const err = e as Error;
    Logger.error('RESTlet error', err);

    return {
      success: false,
      error: {
        code: (err as NetSuiteError).code ?? 'UNEXPECTED_ERROR',
        message: err.message,
        details: (err as NetSuiteError).details,
      },
    };
  }
}
