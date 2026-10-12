import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const output = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node prepare-source-shadow-guide.mjs <new external output>');
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const relative = path.relative(repository, output);
assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Use external evidence storage');
const groups = [
  { body: 'luna', landmark: 'Tycho', coordinates: [-11.36, -43.31], fov: 3, version: 'luna-v3' },
  { body: 'mars', landmark: 'Olympus Mons', coordinates: [-133.8, 18.65], fov: 5, version: 'mars-v2' },
].flatMap((g) => ['standard', 'low'].map((tier) => ({ ...g, tier, id: `${g.body}-${tier}` })));
const cases = [
  { id: 'albedo', label: 'Unlit selected albedo: fixed image patterns', mode: 'albedo', lighting: 'default' },
  ...['gray-relief', 'lit-albedo', 'relief'].flatMap((mode) =>
    ['left', 'right'].map((direction) => ({
      id: `${mode}-${direction}`,
      mode,
      lighting: `source-shadow-${direction}`,
      label: `${mode === 'gray-relief' ? 'Gray terrain relief' : mode === 'lit-albedo' ? 'Albedo without terrain normals' : 'Albedo + terrain relief'}: light from ${direction}`,
    })),
  ),
];
await fs.mkdir(output);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:43187/');
  await page.waitForFunction(() => !!window.diagnostics);
  for (const group of groups) {
    for (const entry of cases) {
      const options = {
        body: group.body,
        tier: group.tier,
        coordinates: group.coordinates,
        fov: group.fov,
        view: 'front',
        mode: entry.mode,
        lighting: entry.lighting,
        variant: 'selected',
        filtering: 'mipmapped',
        segments: 288,
      };
      const result = await page.evaluate((o) => window.diagnostics.render(o), options);
      assert.deepEqual(result.normalScale, entry.mode === 'albedo' ? null : [1, 1]);
      assert.equal(result.usesTerrainNormals, ['gray-relief', 'relief'].includes(entry.mode));
      const pixels = await page.locator('#canvas').evaluate((canvas) => canvas.toDataURL('image/png').split(',')[1]);
      await fs.writeFile(path.join(output, `${group.id}-${entry.id}.png`), Buffer.from(pixels, 'base64'));
      results.push({ options, result });
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(output, 'render-evidence.json'),
    JSON.stringify(
      {
        groups,
        cases,
        results,
        browser: await browser.version(),
        note: 'Isolated source-illumination screening; normal strength unchanged; not final Viewer acceptance.',
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Source-shadow assessment: Tycho and Olympus Mons</title>
<style>
body{background:#181b20;color:#eee;font:16px system-ui;margin:24px;max-width:1600px}
select,button,textarea{font:inherit;padding:8px;margin:8px}textarea{display:block;width:90%;height:100px}
.pair{display:flex;gap:16px}.panel{width:50%}img{display:block;width:100%}
.warning{color:#ffd080}@media(max-width:800px){.pair{display:block}.panel{width:100%}}
</style>
<h1>Source-shadow assessment: Tycho and Olympus Mons</h1>
<p class="warning">Selected assets unchanged. Normal strength stays 1; lighting is diagnostic, not a Viewer setting.
Dark pixels can be real reflectance, rays, haze or image-acquisition shading. Persistence alone does not prove a baked shadow.</p>
<p>First compare unlit albedo with gray relief. Then compare opposite light directions in albedo + relief.
Look for a specific crater wall or ridge with fixed dark/bright shading that contradicts the reversed terrain light,
creates double lighting, or makes a depression appear raised. Do not treat every fixed dark patch as a defect.</p>
<label>Landmark / tier <select id="group">${groups.map((g) => `<option value="${g.id}">${g.landmark} / ${g.tier} (${g.version})</option>`).join('')}</select></label>
<div class="pair">
<section class="panel"><label>Left panel <select id="left">${cases.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}</select></label><img id="left-image" alt="Left source-shadow comparison"></section>
<section class="panel"><label>Right panel <select id="right">${cases.map((c) => `<option value="${c.id}" ${c.id === 'gray-relief-left' ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label><img id="right-image" alt="Right source-shadow comparison"></section>
</div>
<p>All views within a group share camera, geometry and mipmapped filtering. Opposite lights use 65-degree
incidence, ambient 0.15 and directional intensity 2. Gray relief uses neutral #777777; color views have white tint.
The albedo-without-normals view keeps spherical lighting but removes terrain-normal shading.</p>
<label>Assessment <select id="decision">
<option value="unsure">Unsure / need guidance</option>
<option value="acceptable">No distracting source-shadow conflict in the inspected views</option>
<option value="conflict">Possible baked illumination / double-lighting conflict</option>
<option value="other">Other concern described in notes</option></select></label>
<label>Notes / feature / location<textarea id="notes" placeholder="Describe a particular wall/ridge and approximate clock-face location, or why the group looks acceptable."></textarea></label>
<button id="save">Save observation</button><button id="export">Download observations</button>
<p id="status" role="status"></p><h2>Saved observations</h2><ul id="saved"></ul>
<script>
const groups=${JSON.stringify(groups)},cases=${JSON.stringify(cases)},key=${JSON.stringify(`source-shadow:${path.basename(output)}`)};
const byId=id=>document.getElementById(id);let records;
try{records=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(records))throw Error('Invalid saved data');}
catch(error){byId('status').textContent='Saved data error: '+error.message;throw error;}
function update(){for(const side of ['left','right'])byId(side+'-image').src=byId('group').value+'-'+byId(side).value+'.png';}
function summary(){byId('saved').replaceChildren();for(const r of records){const li=document.createElement('li');li.textContent=r.group+': '+r.decision+' — '+r.notes;byId('saved').append(li);}}
byId('left').onchange=update;byId('right').onchange=update;
byId('group').onchange=()=>{byId('notes').value='';byId('decision').value='unsure';update();};
for(const side of ['left','right'])byId(side+'-image').onerror=()=>{byId('status').textContent='Image loading failed: '+side;};
byId('save').onclick=()=>{
if(!byId('notes').value.trim()){byId('status').textContent='Enter review notes before saving.';return;}
const record={group:byId('group').value,left:byId('left').value,right:byId('right').value,decision:byId('decision').value,notes:byId('notes').value.trim(),reviewedAt:new Date().toISOString()};
try{localStorage.setItem(key,JSON.stringify([...records,record]));records.push(record);summary();byId('status').textContent='Saved '+records.length+' observations; review remains open.';}
catch(error){byId('status').textContent='Saving failed: '+error.message;}};
byId('export').onclick=()=>{
if(!records.length){byId('status').textContent='No saved observations. Save before downloading.';return;}
const blob=new Blob([JSON.stringify({evidence:key,scope:'Tycho/Olympus Mons both tiers only',groups,cases,records,gateStatus:'Requires further assessment and explicit acceptance'},null,2)],{type:'application/json'});
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='source-shadow-observations.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
summary();update();
</script></html>`;
await fs.writeFile(path.join(output, 'index.html'), html);
const hash = async (file) =>
  createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
const inventory = await Promise.all(
  (await fs.readdir(output)).map(async (file) => ({
    file,
    sha256: await hash(path.join(output, file)),
  })),
);
const inputs = [];
for (const group of groups) {
  for (const file of [
    `${group.body}-${group.tier}-albedo.jpg`,
    `${group.body}-${group.tier}-normal.png`,
    'derivative-manifest.json',
  ]) {
    inputs.push({
      version: group.version,
      file,
      sha256: await hash(path.join(repository, 'assets', 'sol-textures', group.version, file)),
    });
  }
}
await fs.writeFile(
  path.join(output, 'evidence-inventory.json'),
  JSON.stringify(
    {
      inventory,
      inputs,
      preparationScriptSha256: await hash(fileURLToPath(import.meta.url)),
      diagnosticScriptSha256: await hash(path.join(repository, 'tools', 'sol-textures', 'diagnostic', 'diagnostic.js')),
    },
    null,
    2,
  ),
);
console.log(`PASS: ${results.length} source-shadow control images prepared at ${output}`);
