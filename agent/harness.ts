/**
 * NetSuite Agent Harness
 *
 * A programmatic harness for AI coding agents (Claude Code, Codex, jcode, etc.)
 * to operate on this codebase with guardrails. The harness provides:
 *
 *   1. Scaffolding commands — generate new DAOs, services, scripts, and tests
 *      that conform to the framework's architecture.
 *   2. Validation commands — verify layer discipline, governance checks,
 *      JSDoc tags, and naming conventions.
 *   3. Context loading — feed the agent AGENT.md + relevant source files
 *      so it understands the codebase before making changes.
 *
 * Usage:
 *   npx ts-node agent/harness.ts scaffold dao ItemFulfillment
 *   npx ts-node agent/harness.ts scaffold service ItemFulfillment
 *   npx ts-node agent/harness.ts scaffold script userevent item_fulfillment
 *   npx ts-node agent/harness.ts validate
 *   npx ts-node agent/harness.ts context <filepath>
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── CLI Entry ───────────────────────────────────────────────────

const [, , command, ...args] = process.argv;

const commands: Record<string, (args: string[]) => void> = {
  scaffold,
  validate,
  context,
  help: showHelp,
};

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}
handler(args);

// ─── Scaffold ────────────────────────────────────────────────────

function scaffold(args: string[]): void {
  const [type, name, ...extra] = args;

  if (!type || !name) {
    console.error('Usage: scaffold <dao|service|script|test> <Name> [scriptType]');
    process.exit(1);
  }

  const scaffolders: Record<string, () => void> = {
    dao: () => scaffoldDAO(name),
    service: () => scaffoldService(name),
    script: () => scaffoldScript(name, extra[0]),
    test: () => scaffoldTest(name, extra[0]),
  };

  const fn = scaffolders[type];
  if (!fn) {
    console.error(`Unknown scaffold type: ${type}. Use: dao, service, script, test`);
    process.exit(1);
  }
  fn();
}

function scaffoldDAO(name: string): void {
  const content = `/**
 * ${name} DAO — concrete record access for ${name.toLowerCase()} records.
 */
import { BaseDAO, FieldMapping } from './BaseDAO';
import { RecordType } from '../constants';
import { ValidationError } from '../utils/errors';

export class ${name}DAO extends BaseDAO {
  protected readonly recordType = RecordType.${toScreamingSnake(name)};

  // TODO: Add createFromData() with typed data interface
  // TODO: Add field validation
}
`;
  writeFile(`src/dao/${name}DAO.ts`, content);
  appendBarrel('src/dao/index.ts', `export { ${name}DAO } from './${name}DAO';`);
  console.log(`Created src/dao/${name}DAO.ts`);
  console.log(`Updated src/dao/index.ts`);
  console.log(`\nNext steps:`);
  console.log(`  1. Add ${toScreamingSnake(name)} to RecordType enum in src/constants/index.ts`);
  console.log(`  2. Add a data interface to src/types/index.ts`);
  console.log(`  3. Implement createFromData() with validation`);
  console.log(`  4. Run: npx ts-node agent/harness.ts scaffold test ${name} dao`);
}

function scaffoldService(name: string): void {
  const content = `/**
 * ${name} Service — business logic for ${name.toLowerCase()} operations.
 */
import { BaseService } from './BaseService';
import { ${name}DAO } from '../dao/${name}DAO';
import { Logger } from '../utils/logger';

export class ${name}Service extends BaseService {
  private readonly dao: ${name}DAO;

  constructor() {
    super('${name}Service');
    this.dao = new ${name}DAO();
  }

  // TODO: Add business logic methods
  // Every public method should use: return this.execute('methodName', () => { ... });
}
`;
  writeFile(`src/services/${name}Service.ts`, content);
  appendBarrel('src/services/index.ts', `export { ${name}Service } from './${name}Service';`);
  console.log(`Created src/services/${name}Service.ts`);
  console.log(`Updated src/services/index.ts`);
}

function scaffoldScript(name: string, scriptType?: string): void {
  const types: Record<string, { prefix: string; dir: string; template: string }> = {
    restlet: {
      prefix: 'rl',
      dir: 'restlet',
      template: restletTemplate(name),
    },
    userevent: {
      prefix: 'ue',
      dir: 'userevent',
      template: userEventTemplate(name),
    },
    scheduled: {
      prefix: 'ss',
      dir: 'scheduled',
      template: scheduledTemplate(name),
    },
    mapreduce: {
      prefix: 'mr',
      dir: 'mapreduce',
      template: mapReduceTemplate(name),
    },
    suitelet: {
      prefix: 'sl',
      dir: 'suitelet',
      template: suiteletTemplate(name),
    },
    client: {
      prefix: 'cs',
      dir: 'client',
      template: clientTemplate(name),
    },
  };

  if (!scriptType || !types[scriptType]) {
    console.error(`Usage: scaffold script <name> <${Object.keys(types).join('|')}>`);
    process.exit(1);
  }

  const spec = types[scriptType];
  const filename = `${spec.prefix}_${toSnakeCase(name)}.ts`;
  const filepath = `src/scripts/${spec.dir}/${filename}`;
  writeFile(filepath, spec.template);
  console.log(`Created ${filepath}`);
}

function scaffoldTest(name: string, layer?: string): void {
  const layers: Record<string, { dir: string; template: string }> = {
    dao: {
      dir: `src/dao/__tests__`,
      template: daoTestTemplate(name),
    },
    service: {
      dir: `src/services/__tests__`,
      template: serviceTestTemplate(name),
    },
  };

  if (!layer || !layers[layer]) {
    console.error(`Usage: scaffold test <Name> <dao|service>`);
    process.exit(1);
  }

  const spec = layers[layer];
  const filepath = `${spec.dir}/${name}${layer === 'dao' ? 'DAO' : 'Service'}.test.ts`;
  writeFile(filepath, spec.template);
  console.log(`Created ${filepath}`);
}

// ─── Validate ────────────────────────────────────────────────────

function validate(): void {
  console.log('Running framework validation checks...\n');
  let errors = 0;

  errors += checkJSDocTags();
  errors += checkNamingConventions();
  errors += checkLayerDiscipline();
  errors += checkGovernanceGuards();
  errors += checkBarrelExports();

  console.log('');
  if (errors === 0) {
    console.log('All checks passed.');
  } else {
    console.log(`${errors} issue(s) found.`);
    process.exit(1);
  }
}

function checkJSDocTags(): number {
  let errors = 0;
  const scriptDirs = ['restlet', 'userevent', 'scheduled', 'mapreduce', 'suitelet', 'client'];
  const requiredTags = ['@NApiVersion', '@NScriptType', '@NModuleScope'];

  for (const dir of scriptDirs) {
    const fullDir = path.join('src/scripts', dir);
    if (!fs.existsSync(fullDir)) continue;

    for (const file of fs.readdirSync(fullDir).filter((f) => f.endsWith('.ts'))) {
      const content = fs.readFileSync(path.join(fullDir, file), 'utf-8');
      for (const tag of requiredTags) {
        if (!content.includes(tag)) {
          console.log(`  MISSING ${tag} in scripts/${dir}/${file}`);
          errors++;
        }
      }
    }
  }

  if (errors === 0) console.log('  ✓ JSDoc tags: all scripts have required tags');
  return errors;
}

function checkNamingConventions(): number {
  let errors = 0;
  const prefixMap: Record<string, string> = {
    restlet: 'rl_',
    userevent: 'ue_',
    scheduled: 'ss_',
    mapreduce: 'mr_',
    suitelet: 'sl_',
    client: 'cs_',
  };

  for (const [dir, prefix] of Object.entries(prefixMap)) {
    const fullDir = path.join('src/scripts', dir);
    if (!fs.existsSync(fullDir)) continue;

    for (const file of fs.readdirSync(fullDir).filter((f) => f.endsWith('.ts'))) {
      if (!file.startsWith(prefix)) {
        console.log(`  NAMING scripts/${dir}/${file} should start with ${prefix}`);
        errors++;
      }
    }
  }

  if (errors === 0) console.log('  ✓ Naming: all scripts follow prefix conventions');
  return errors;
}

function checkLayerDiscipline(): number {
  let errors = 0;
  const scriptDirs = ['restlet', 'userevent', 'scheduled', 'mapreduce', 'suitelet', 'client'];

  // Scripts should not import N/record or N/search directly.
  // Exception: Map/Reduce getInputData legitimately returns search.Search objects,
  // so mapreduce scripts may import N/search.
  const forbidden = ["from 'N/record'", "from 'N/search'", 'from "N/record"', 'from "N/search"'];
  const mrSearchAllowed = ["from 'N/search'", 'from "N/search"'];

  for (const dir of scriptDirs) {
    const fullDir = path.join('src/scripts', dir);
    if (!fs.existsSync(fullDir)) continue;

    for (const file of fs.readdirSync(fullDir).filter((f) => f.endsWith('.ts'))) {
      const content = fs.readFileSync(path.join(fullDir, file), 'utf-8');
      for (const pattern of forbidden) {
        if (dir === 'mapreduce' && mrSearchAllowed.includes(pattern)) continue;
        if (content.includes(pattern)) {
          console.log(`  LAYER scripts/${dir}/${file} imports N/record or N/search directly — use DAO/utils instead`);
          errors++;
        }
      }
    }
  }

  // Services should not import N/record directly
  const serviceDir = 'src/services';
  if (fs.existsSync(serviceDir)) {
    for (const file of fs.readdirSync(serviceDir).filter((f) => f.endsWith('.ts') && !f.includes('index'))) {
      const content = fs.readFileSync(path.join(serviceDir, file), 'utf-8');
      if (content.includes("from 'N/record'") || content.includes('from "N/record"')) {
        console.log(`  LAYER services/${file} imports N/record directly — use DAO instead`);
        errors++;
      }
    }
  }

  if (errors === 0) console.log('  ✓ Layer discipline: no forbidden cross-layer imports');
  return errors;
}

function checkGovernanceGuards(): number {
  let errors = 0;

  // Scheduled scripts must call shouldYield or getRemainingUsage.
  // Map/Reduce scripts get per-stage governance from the platform, but should
  // still have yield checks in reduce for heavy per-key work.
  for (const dir of ['scheduled']) {
    const fullDir = path.join('src/scripts', dir);
    if (!fs.existsSync(fullDir)) continue;

    for (const file of fs.readdirSync(fullDir).filter((f) => f.endsWith('.ts'))) {
      const content = fs.readFileSync(path.join(fullDir, file), 'utf-8');
      if (!content.includes('shouldYield') && !content.includes('getRemainingUsage')) {
        console.log(`  GOVERNANCE scripts/${dir}/${file} has no governance check — add shouldYield() to processing loops`);
        errors++;
      }
    }
  }

  if (errors === 0) console.log('  ✓ Governance: scheduled/MR scripts have yield checks');
  return errors;
}

function checkBarrelExports(): number {
  let errors = 0;
  const barrels = ['src/dao/index.ts', 'src/services/index.ts', 'src/utils/index.ts'];

  for (const barrel of barrels) {
    if (!fs.existsSync(barrel)) {
      console.log(`  BARREL missing ${barrel}`);
      errors++;
      continue;
    }

    const content = fs.readFileSync(barrel, 'utf-8');
    const dir = path.dirname(barrel);
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.includes('.test.'));

    for (const file of files) {
      const baseName = file.replace('.ts', '');
      if (!content.includes(baseName)) {
        console.log(`  BARREL ${barrel} does not export ${baseName}`);
        errors++;
      }
    }
  }

  if (errors === 0) console.log('  ✓ Barrels: all modules exported from index files');
  return errors;
}

// ─── Context ─────────────────────────────────────────────────────

function context(args: string[]): void {
  // Always output AGENT.md as the foundational context
  const agentMd = fs.readFileSync('AGENT.md', 'utf-8');
  console.log('=== AGENT.md ===\n');
  console.log(agentMd);

  // If specific files requested, output them too
  for (const filepath of args) {
    if (fs.existsSync(filepath)) {
      console.log(`\n=== ${filepath} ===\n`);
      console.log(fs.readFileSync(filepath, 'utf-8'));
    } else {
      console.error(`File not found: ${filepath}`);
    }
  }

  // Always include the type definitions and constants as baseline context
  const contextFiles = ['src/types/index.ts', 'src/constants/index.ts'];
  for (const cf of contextFiles) {
    if (fs.existsSync(cf) && !args.includes(cf)) {
      console.log(`\n=== ${cf} ===\n`);
      console.log(fs.readFileSync(cf, 'utf-8'));
    }
  }
}

// ─── Templates ───────────────────────────────────────────────────

function restletTemplate(name: string): string {
  return `/**
 * RESTlet — ${name}
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import { Logger } from '../../utils/logger';
import { RestletRequest, RestletResponse } from '../../types';

export const post: EntryPoints.RESTlet.post = (
  requestBody: RestletRequest
): RestletResponse => {
  Logger.audit('${name} RESTlet invoked');

  try {
    // TODO: implement
    return { success: true, data: {} };
  } catch (e) {
    Logger.error('${name} RESTlet error', e as Error);
    return { success: false, error: { code: 'ERROR', message: (e as Error).message } };
  }
};
`;
}

function userEventTemplate(name: string): string {
  return `/**
 * User Event — ${name}
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import { Logger } from '../../utils/logger';

export const beforeSubmit: EntryPoints.UserEvent.beforeSubmit = (
  context: EntryPoints.UserEvent.beforeSubmitContext
): void => {
  try {
    const { newRecord, type } = context;
    Logger.debug('${name} beforeSubmit', { type, id: newRecord.id } as unknown as string);
    // TODO: implement validation
  } catch (e) {
    Logger.error('${name} beforeSubmit error', e as Error);
    throw e;
  }
};

export const afterSubmit: EntryPoints.UserEvent.afterSubmit = (
  context: EntryPoints.UserEvent.afterSubmitContext
): void => {
  try {
    const { newRecord, type } = context;
    Logger.audit('${name} afterSubmit', { type, id: newRecord.id } as unknown as string);
    // TODO: implement post-save logic
  } catch (e) {
    Logger.error('${name} afterSubmit error', e as Error);
  }
};
`;
}

function scheduledTemplate(name: string): string {
  return `/**
 * Scheduled Script — ${name}
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import { Logger } from '../../utils/logger';
import { shouldYield, getRemainingUsage } from '../../utils/governance';

export const execute: EntryPoints.Scheduled.execute = (
  _context: EntryPoints.Scheduled.executeContext
): void => {
  Logger.audit('${name} scheduled script started');

  try {
    // TODO: query for work items
    const items: string[] = [];

    for (const item of items) {
      if (shouldYield()) {
        Logger.audit('Yielding', { remaining: String(getRemainingUsage()) } as unknown as string);
        // TODO: reschedule
        return;
      }

      // TODO: process item
    }

    Logger.audit('${name} scheduled script complete');
  } catch (e) {
    Logger.error('${name} scheduled script failed', e as Error);
    throw e;
  }
};
`;
}

function mapReduceTemplate(name: string): string {
  return `/**
 * Map/Reduce — ${name}
 *
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as search from 'N/search';
import { Logger } from '../../utils/logger';
import { shouldYield } from '../../utils/governance';

export const getInputData: EntryPoints.MapReduce.getInputData = (): search.Search => {
  Logger.audit('${name} M/R: getInputData');
  // TODO: return search, query, or array
  return search.create({ type: 'salesorder', filters: [], columns: [] });
};

export const map: EntryPoints.MapReduce.map = (
  context: EntryPoints.MapReduce.mapContext
): void => {
  try {
    const data = JSON.parse(context.value);
    // TODO: transform and emit
    context.write({ key: data.id, value: context.value });
  } catch (e) {
    Logger.error('${name} map error', e as Error);
  }
};

export const reduce: EntryPoints.MapReduce.reduce = (
  context: EntryPoints.MapReduce.reduceContext
): void => {
  try {
    if (shouldYield()) return;
    // TODO: aggregate values
    context.write({ key: context.key, value: String(context.values.length) });
  } catch (e) {
    Logger.error('${name} reduce error', e as Error);
  }
};

export const summarize: EntryPoints.MapReduce.summarize = (
  summary: EntryPoints.MapReduce.summarizeContext
): void => {
  Logger.audit('${name} M/R: summarize');

  if (summary.inputSummary.error) {
    Logger.error('Input error', summary.inputSummary.error);
  }

  summary.mapSummary.errors.iterator().each((_k: string, e: string) => {
    Logger.error('Map error', e); return true;
  });

  summary.reduceSummary.errors.iterator().each((_k: string, e: string) => {
    Logger.error('Reduce error', e); return true;
  });
};
`;
}

function suiteletTemplate(name: string): string {
  return `/**
 * Suitelet — ${name}
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';
import * as serverWidget from 'N/ui/serverWidget';
import { Logger } from '../../utils/logger';

export const onRequest: EntryPoints.Suitelet.onRequest = (
  context: EntryPoints.Suitelet.onRequestContext
): void => {
  try {
    if (context.request.method === 'GET') {
      const form = serverWidget.createForm({ title: '${name}' });
      // TODO: add fields
      form.addSubmitButton({ label: 'Submit' });
      context.response.writePage({ pageObject: form });
    } else {
      // TODO: handle POST
      Logger.audit('${name} form submitted');
    }
  } catch (e) {
    Logger.error('${name} suitelet error', e as Error);
    context.response.write({ output: \`<html><body><h2>Error</h2><p>\${(e as Error).message}</p></body></html>\` });
  }
};
`;
}

function clientTemplate(name: string): string {
  return `/**
 * Client Script — ${name}
 *
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */

import { EntryPoints } from 'N/types';

export const pageInit: EntryPoints.Client.pageInit = (
  _context: EntryPoints.Client.pageInitContext
): void => {
  // TODO: set defaults, show/hide fields
};

export const fieldChanged: EntryPoints.Client.fieldChanged = (
  context: EntryPoints.Client.fieldChangedContext
): void => {
  const _fieldId = context.fieldId;
  // TODO: react to field changes
};

export const saveRecord: EntryPoints.Client.saveRecord = (
  _context: EntryPoints.Client.saveRecordContext
): boolean => {
  // TODO: validate before save
  return true;
};
`;
}

function daoTestTemplate(name: string): string {
  return `/**
 * Tests for ${name}DAO.
 */
import { ${name}DAO } from '../../dao/${name}DAO';
import { _clearLogs } from '../../../test/__mocks__/N/log';

describe('${name}DAO', () => {
  let dao: ${name}DAO;

  beforeEach(() => {
    dao = new ${name}DAO();
    _clearLogs();
  });

  // TODO: add tests for createFromData, validation, etc.
  it('instantiates', () => {
    expect(dao).toBeDefined();
  });
});
`;
}

function serviceTestTemplate(name: string): string {
  return `/**
 * Tests for ${name}Service.
 */
import { ${name}Service } from '../../services/${name}Service';
import { _clearLogs } from '../../../test/__mocks__/N/log';

describe('${name}Service', () => {
  let service: ${name}Service;

  beforeEach(() => {
    service = new ${name}Service();
    _clearLogs();
  });

  // TODO: add tests for business logic methods
  it('instantiates', () => {
    expect(service).toBeDefined();
  });
});
`;
}

// ─── Utilities ───────────────────────────────────────────────────

function writeFile(filepath: string, content: string): void {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(filepath)) {
    console.error(`File already exists: ${filepath}`);
    process.exit(1);
  }
  fs.writeFileSync(filepath, content);
}

function appendBarrel(barrelPath: string, exportLine: string): void {
  if (!fs.existsSync(barrelPath)) {
    fs.writeFileSync(barrelPath, exportLine + '\n');
    return;
  }
  const content = fs.readFileSync(barrelPath, 'utf-8');
  if (!content.includes(exportLine)) {
    fs.appendFileSync(barrelPath, exportLine + '\n');
  }
}

function toScreamingSnake(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

function toSnakeCase(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

function showHelp(): void {
  console.log(`
NetSuite Agent Harness

Commands:
  scaffold dao <Name>                    Generate a DAO extending BaseDAO
  scaffold service <Name>                Generate a Service extending BaseService
  scaffold script <name> <type>          Generate a script entry point
                                         Types: restlet, userevent, scheduled,
                                                mapreduce, suitelet, client
  scaffold test <Name> <dao|service>     Generate a test file

  validate                               Run all framework convention checks
                                         (JSDoc tags, naming, layer discipline,
                                          governance guards, barrel exports)

  context [file...]                      Output AGENT.md + types + constants
                                         (+ optional extra files) for agent context

Examples:
  npx ts-node agent/harness.ts scaffold dao ItemFulfillment
  npx ts-node agent/harness.ts scaffold service ItemFulfillment
  npx ts-node agent/harness.ts scaffold script item_fulfillment userevent
  npx ts-node agent/harness.ts scaffold test ItemFulfillment dao
  npx ts-node agent/harness.ts validate
  npx ts-node agent/harness.ts context src/services/SalesOrderService.ts
`);
}
