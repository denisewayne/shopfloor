/**
 * Helpers for script entry points: resolve the active profile and build
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

/** Profile from the deployment parameter, or the given fallback. */
export function activeProfile(config: NetSuiteConfig = defaultNetSuiteConfig, fallback?: string): BusinessProfile {
  const v = param(config.params.profile);
  return getProfile(v ? String(v) : fallback);
}

export function shopfloor(config: NetSuiteConfig = defaultNetSuiteConfig, fallbackProfile?: string): {
  profile: BusinessProfile;
  backend: NetSuiteBackend;
  inventory: InventoryService;
  production: ProductionService;
  retail: RetailService;
} {
  const profile = activeProfile(config, fallbackProfile);
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
