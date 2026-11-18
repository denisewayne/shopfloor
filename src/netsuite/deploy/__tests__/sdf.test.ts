/**
 * The SDF generator and the deployment manifest it reads.
 */
import * as fs from 'fs';
import * as path from 'path';
import { SCRIPTS, ScriptSpec, FILE_CABINET_ROOT } from '../manifest';
import { render, scriptXml, validate, esc } from '../../../../scripts/generate-sdf';

const scripts = SCRIPTS as unknown as Record<string, ScriptSpec>;
const repo = path.resolve(__dirname, '../../../..');

describe('deployment manifest', () => {
  it('passes NetSuite id rules (prefixes, lengths, account-wide uniqueness)', () => {
    expect(validate(scripts)).toEqual([]);
  });

  it('points every script at a real source file', () => {
    for (const s of Object.values(scripts)) {
      expect(fs.existsSync(path.join(repo, 'src', s.file.replace(/\.js$/, '.ts')))).toBe(true);
    }
  });

  it('matches the File Cabinet folder used by the stage script', () => {
    const stage = fs.readFileSync(path.join(repo, 'scripts/stage-suitecloud.sh'), 'utf8');
    expect(stage).toContain(`suitecloud/src/FileCabinet${FILE_CABINET_ROOT}`);
  });
});

describe('validate', () => {
  const base: ScriptSpec = {
    kind: 'scheduledscript', scriptId: 'customscript_a', deploymentId: 'customdeploy_a',
    name: 'A', description: '', file: 'a.js', params: {},
  };

  it('catches duplicate parameter ids across scripts', () => {
    const p = { x: { id: 'custscript_dup', label: 'X', type: 'TEXT' as const, help: '' } };
    const errs = validate({
      a: { ...base, params: p },
      b: { ...base, scriptId: 'customscript_b', deploymentId: 'customdeploy_b', params: p },
    });
    expect(errs.join()).toMatch(/custscript_dup already used by a/);
  });

  it('catches over-long and badly prefixed ids', () => {
    const errs = validate({
      a: {
        ...base,
        scriptId: 'script_a',
        params: { x: { id: 'custscript_' + 'x'.repeat(25), label: 'X', type: 'TEXT', help: '' } },
      },
    });
    expect(errs.join()).toMatch(/customscript_/);
    expect(errs.join()).toMatch(/over 30 chars/);
  });
});

describe('generated XML', () => {
  const xml = scriptXml(scripts.inventoryReorder);

  it('ships deployments in a safe state', () => {
    expect(xml).toContain('<status>NOTSCHEDULED</status>');
    expect(scriptXml(scripts.api)).toContain('<status>TESTING</status>');
  });

  it('keeps the create-POs checkbox off by default', () => {
    const block = xml.split('custscript_sf_ro_create_pos')[1].split('</scriptcustomfield>')[0];
    expect(block).toContain('<fieldtype>CHECKBOX</fieldtype>');
    expect(block).toContain('<defaultchecked>F</defaultchecked>');
    expect(block).not.toContain('<defaultvalue>');
  });

  it('references the staged script file', () => {
    expect(xml).toContain('<scriptfile>[/SuiteScripts/shopfloor/netsuite/scripts/scheduled/ss_inventory_reorder.js]</scriptfile>');
  });

  it('escapes XML special characters', () => {
    expect(esc(`a & <b> "c"`)).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });

  it('matches the committed files in suitecloud/src/Objects', () => {
    for (const [name, content] of Object.entries(render(scripts))) {
      const committed = fs.readFileSync(path.join(repo, 'suitecloud/src/Objects', name), 'utf8');
      expect(committed).toBe(content);
    }
  });
});
