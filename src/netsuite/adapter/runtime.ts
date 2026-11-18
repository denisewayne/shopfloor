/**
 * Helpers for script entry points: read deployment parameters and build
 * core services wired to the NetSuite backend.
 */
import { BusinessProfile, getProfile } from '../../core/profiles/index';
import { InventoryService, ProductionService, RetailService } from '../../core/services/index';
import { getScriptParameter } from '../utils/governance';
import { NetSuiteBackend, netSuiteLogger } from './index';
import { NetSuiteConfig, defaultNetSuiteConfig } from './config';

export function param(name: string): string | number | boolean | null {
  try {
    return getScriptParameter(name);
  } catch (_e) {
    return null;
  }
}

export interface Shopfloor {
  profile: BusinessProfile;
  backend: NetSuiteBackend;
  inventory: InventoryService;
  production: ProductionService;
  retail: RetailService;
}

/**
 * Wire up services for the current script.
 * @param profileParam deployment parameter holding the profile id
 * @param fallbackProfile used when the parameter is blank
 */
export function shopfloor(
  profileParam: string,
  fallbackProfile?: string,
  config: NetSuiteConfig = defaultNetSuiteConfig
): Shopfloor {
  const v = param(profileParam);
  const profile = getProfile(v ? String(v) : fallbackProfile);
  const backend = new NetSuiteBackend(config);
  const deps = { logger: netSuiteLogger };
  return {
    profile,
    backend,
    inventory: new InventoryService({ ...deps, stock: backend, purchaseOrders: backend }, profile),
    production: new ProductionService({ ...deps, workOrders: backend }, profile),
    retail: new RetailService({ ...deps, sales: backend }, profile),
  };
}
