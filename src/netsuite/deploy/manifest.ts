/**
 * Deployment manifest: the single source of truth for which scripts get
 * installed in NetSuite, their deployments, and their parameters.
 *
 * Scripts read their parameter ids from here, and `npm run sdf` turns this
 * file into SuiteCloud object XML (suitecloud/src/Objects). Change an id
 * here and both sides stay in sync.
 *
 * NetSuite rules: script parameter ids are unique across the whole account
 * (so each script gets its own), and must be 30 characters or fewer.
 */

export type ScriptKind = 'scheduledscript' | 'restlet';
export type ParamType = 'TEXT' | 'CHECKBOX' | 'INTEGER';

export interface ParamSpec {
  id: string;
  label: string;
  type: ParamType;
  help: string;
  /** Default for TEXT/INTEGER fields. */
  defaultValue?: string;
  /** Default for CHECKBOX fields. */
  defaultChecked?: boolean;
}

export interface ScriptSpec {
  kind: ScriptKind;
  scriptId: string;
  deploymentId: string;
  name: string;
  description: string;
  /** Path of the compiled file relative to build/. */
  file: string;
  params: Record<string, ParamSpec>;
}

const profileHelp = 'Business profile: general, manufacturing, or retail.';

export const SCRIPTS = {
  inventoryReorder: {
    kind: 'scheduledscript',
    scriptId: 'customscript_sf_inventory_reorder',
    deploymentId: 'customdeploy_sf_inventory_reorder',
    name: 'Shopfloor: Inventory Reorder',
    description: 'Finds items at or below their reorder point and drafts purchase orders per vendor. Dry run unless Create purchase orders is checked.',
    file: 'netsuite/scripts/scheduled/ss_inventory_reorder.js',
    params: {
      profile: { id: 'custscript_sf_ro_profile', label: 'Business profile', type: 'TEXT', defaultValue: 'general', help: profileHelp },
      savedSearch: { id: 'custscript_sf_ro_search', label: 'Stock saved search (optional)', type: 'TEXT', help: 'Saved search id whose column labels match adapter/config.ts. Leave blank to use the built-in item search.' },
      createPos: { id: 'custscript_sf_ro_create_pos', label: 'Create purchase orders', type: 'CHECKBOX', defaultChecked: false, help: 'Unchecked = dry run: suggestions are only logged.' },
      location: { id: 'custscript_sf_ro_location', label: 'PO location id (optional)', type: 'TEXT', help: 'Internal id of the receiving location.' },
    },
  },
  dailyClose: {
    kind: 'scheduledscript',
    scriptId: 'customscript_sf_daily_close',
    deploymentId: 'customdeploy_sf_daily_close',
    name: 'Shopfloor: Daily Close',
    description: 'Totals the day\'s cash sales by payment method and logs the summary.',
    file: 'netsuite/scripts/scheduled/ss_daily_close.js',
    params: {
      profile: { id: 'custscript_sf_dc_profile', label: 'Business profile', type: 'TEXT', defaultValue: 'retail', help: profileHelp },
      date: { id: 'custscript_sf_dc_date', label: 'Date override (optional)', type: 'TEXT', help: 'Close a specific date instead of today, in your account date format.' },
    },
  },
  api: {
    kind: 'restlet',
    scriptId: 'customscript_sf_api',
    deploymentId: 'customdeploy_sf_api',
    name: 'Shopfloor: API',
    description: 'JSON API: ping, profile, reorderPreview, scheduleBuild, closeDay.',
    file: 'netsuite/scripts/restlet/rl_api_router.js',
    params: {
      profile: { id: 'custscript_sf_api_profile', label: 'Business profile', type: 'TEXT', defaultValue: 'general', help: profileHelp },
    },
  },
} as const satisfies Record<string, ScriptSpec>;

/** Where the File Cabinet copy of build/ lives. Must match scripts/stage-suitecloud.sh. */
export const FILE_CABINET_ROOT = '/SuiteScripts/shopfloor';
