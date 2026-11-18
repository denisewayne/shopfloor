/**
 * Production Service: decides how many assemblies to build and creates the
 * work order, warning about component shortages before the floor finds out.
 */
import { BaseService } from './BaseService';
import { WorkOrderDAO } from '../dao/WorkOrderDAO';
import { BusinessProfile, getProfile } from '../profiles';
import { BomComponent, explodeBom, findShortages, planBuildQuantity } from '../domain/production';
import { InternalId } from '../types';
import { ValidationError } from '../utils/errors';
import { Logger } from '../utils/logger';

export interface BuildRequest {
  assemblyId: string;
  openDemand: number;
  available: number;
  bom: BomComponent[];
  componentStock: Record<string, number>;
  location?: InternalId;
  subsidiary?: InternalId;
  salesOrderId?: InternalId;
}

export interface BuildResult {
  buildQuantity: number;
  workOrderId: number | null;
  shortages: ReturnType<typeof findShortages>;
}

export class ProductionService extends BaseService {
  private readonly dao = new WorkOrderDAO();
  private readonly profile: BusinessProfile;

  constructor(profile: BusinessProfile = getProfile('manufacturing')) {
    super('ProductionService');
    this.profile = profile;
  }

  /**
   * Plan and (unless dryRun) create a work order.
   * Shortages do not block the work order. They are returned so a person can
   * expedite purchasing. Set blockOnShortage to refuse instead.
   */
  scheduleBuild(req: BuildRequest, opts: { dryRun?: boolean; blockOnShortage?: boolean } = {}): BuildResult {
    return this.execute('scheduleBuild', () => {
      if (!this.profile.modules.production) {
        throw new ValidationError(`Production module is disabled for the ${this.profile.id} profile`);
      }

      const buildQuantity = planBuildQuantity(req.openDemand, req.available, this.profile);
      if (buildQuantity === 0) return { buildQuantity, workOrderId: null, shortages: [] };

      const plan = explodeBom(req.assemblyId, buildQuantity, req.bom);
      const shortages = findShortages(plan, req.componentStock);

      if (shortages.length > 0 && opts.blockOnShortage) {
        throw new ValidationError(
          `Cannot build ${buildQuantity}: short on ${shortages.map((s) => s.itemId).join(', ')}`
        );
      }

      let workOrderId: number | null = null;
      if (!opts.dryRun) {
        workOrderId = this.dao.createFromData({
          assemblyItem: req.assemblyId,
          quantity: buildQuantity,
          location: req.location,
          subsidiary: req.subsidiary,
          createdFrom: req.salesOrderId,
          memo: shortages.length ? `Component shortages: ${shortages.length}` : undefined,
        });
      }

      Logger.audit('Build scheduled', { assemblyId: req.assemblyId, buildQuantity, workOrderId, shortages: shortages.length });
      return { buildQuantity, workOrderId, shortages };
    });
  }
}
