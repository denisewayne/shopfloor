/**
 * Build planning: sizes a production run from demand, pads for scrap,
 * rounds to batch size, checks component shortages, and creates the
 * work order. Back-end agnostic.
 */
import { BusinessProfile, getProfile } from '../profiles/index';
import { BomComponent, explodeBom, findShortages, planBuildQuantity } from '../domain/production';
import { Id, Logger, WorkOrderWriter, silentLogger } from '../ports/index';
import { ValidationError } from '../errors';

export interface BuildRequest {
  assemblyId: Id;
  openDemand: number;
  available: number;
  bom: BomComponent[];
  componentStock: Record<string, number>;
  locationId?: Id;
  subsidiaryId?: Id;
  sourceId?: Id;
}

export interface BuildResult {
  buildQuantity: number;
  workOrderId: Id | null;
  shortages: ReturnType<typeof findShortages>;
}

export interface ProductionDeps {
  workOrders: WorkOrderWriter;
  logger?: Logger;
}

export class ProductionService {
  private readonly log: Logger;

  constructor(
    private readonly deps: ProductionDeps,
    private readonly profile: BusinessProfile = getProfile('manufacturing')
  ) {
    this.log = deps.logger ?? silentLogger;
  }

  scheduleBuild(req: BuildRequest, opts: { dryRun?: boolean; blockOnShortage?: boolean } = {}): BuildResult {
    if (!this.profile.modules.production) {
      throw new ValidationError(`Production module is disabled for the ${this.profile.id} profile`);
    }
    if (!req.assemblyId) throw new ValidationError('assemblyId is required', 'assemblyId');

    const buildQuantity = planBuildQuantity(req.openDemand, req.available, this.profile);
    if (buildQuantity === 0) return { buildQuantity, workOrderId: null, shortages: [] };

    const plan = explodeBom(req.assemblyId, buildQuantity, req.bom);
    const shortages = findShortages(plan, req.componentStock);

    if (shortages.length > 0 && opts.blockOnShortage) {
      throw new ValidationError(
        `Cannot build ${buildQuantity}: short on ${shortages.map((s) => s.itemId).join(', ')}`
      );
    }

    let workOrderId: Id | null = null;
    if (!opts.dryRun) {
      workOrderId = this.deps.workOrders.createWorkOrder({
        assemblyId: req.assemblyId,
        quantity: buildQuantity,
        locationId: req.locationId,
        subsidiaryId: req.subsidiaryId,
        sourceId: req.sourceId,
        memo: shortages.length ? `Component shortages: ${shortages.length}` : undefined,
      });
    }

    this.log.info('Build scheduled', { assemblyId: req.assemblyId, buildQuantity, workOrderId, shortages: shortages.length });
    return { buildQuantity, workOrderId, shortages };
  }
}
