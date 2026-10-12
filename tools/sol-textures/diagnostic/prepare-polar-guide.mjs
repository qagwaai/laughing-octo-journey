import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const output = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || (process.argv[3] && !['--all', '--luna-controls'].includes(process.argv[3]))) {
  throw new Error(
    'Usage: node prepare-polar-guide.mjs <new external output folder> [--all|--luna-controls] [external source references]',
  );
}
const controls = process.argv[3] === '--luna-controls';
if (controls && !process.argv[4])
  throw new Error('Luna controls require the retained external source-reference directory');
const all = process.argv[3] === '--all';
const groups =
  all || controls
    ? (controls ? ['luna'] : ['mars', 'luna']).flatMap((body) =>
        ['north', 'south'].flatMap((pole) =>
          ['standard', 'low'].map((tier) => ({ body, pole, tier, id: `${body}-${pole}-${tier}` })),
        ),
      )
    : [{ body: 'mars', pole: 'north', tier: 'standard', id: 'mars-north-standard' }];
const versions = { mars: ['mars-v1', 'mars-v2'], luna: ['luna-v2', 'luna-v3'] };
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const relative = path.relative(repository, output);
assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Output must be outside repository');
await fs.mkdir(output);
const cases = [
  {
    id: 'band-left',
    label: 'Blend band: dark gray, light from left',
    mode: 'gray-relief',
    fov: 12,
    lighting: 'polar-grazing-left',
  },
  {
    id: 'band-right',
    label: 'Blend band: dark gray, light from right',
    mode: 'gray-relief',
    fov: 12,
    lighting: 'polar-grazing-right',
  },
  {
    id: 'detail-left',
    label: 'Closer view: dark gray, light from left',
    mode: 'gray-relief',
    fov: 6,
    lighting: 'polar-grazing-left',
  },
  {
    id: 'detail-right',
    label: 'Closer view: dark gray, light from right',
    mode: 'gray-relief',
    fov: 6,
    lighting: 'polar-grazing-right',
  },
  { id: 'color', label: 'Albedo + relief, light from left', mode: 'relief', fov: 12, lighting: 'polar-grazing-left' },
];
if (controls) {
  cases.push(
    {
      id: 'detail-nearest-left',
      label: 'Closer view: nearest filter, light from left',
      mode: 'gray-relief',
      fov: 6,
      lighting: 'polar-grazing-left',
      filtering: 'nearest',
    },
    {
      id: 'detail-nearest-right',
      label: 'Closer view: nearest filter, light from right',
      mode: 'gray-relief',
      fov: 6,
      lighting: 'polar-grazing-right',
      filtering: 'nearest',
    },
    {
      id: 'detail-flat-left',
      label: 'Closer view: neutral normal control, light from left',
      mode: 'flat-normal',
      fov: 6,
      lighting: 'polar-grazing-left',
    },
    {
      id: 'detail-flat-right',
      label: 'Closer view: neutral normal control, light from right',
      mode: 'flat-normal',
      fov: 6,
      lighting: 'polar-grazing-right',
    },
  );
}
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
      for (const variant of ['baseline', 'selected']) {
        const options = {
          body: group.body,
          tier: group.tier,
          view: group.pole,
          coordinates: [0, group.pole === 'north' ? 90 : -90],
          mode: entry.mode,
          fov: entry.fov,
          variant,
          filtering: entry.filtering ?? 'mipmapped',
          segments: 288,
          lighting: entry.lighting,
        };
        const result = await page.evaluate((options) => window.diagnostics.render(options), options);
        assert.deepEqual(result.normalScale, [1, 1], 'Physical normal strength must remain unchanged');
        const pixels = await page.locator('#canvas').evaluate((canvas) => canvas.toDataURL('image/png').split(',')[1]);
        await fs.writeFile(path.join(output, `${group.id}-${entry.id}-${variant}.png`), Buffer.from(pixels, 'base64'));
        results.push({ options, result });
      }
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(output, 'render-evidence.json'),
    JSON.stringify(
      {
        browser: await browser.version(),
        renderer: 'SwiftShader correctness renderer',
        results,
        note: 'Guided screening only; no asset changes or final Viewer acceptance.',
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Guided Mars polar review</title>
<style>
body{background:#16191e;color:#eee;font:16px system-ui;margin:24px;max-width:1600px}
button,select,textarea{font:inherit;padding:8px;margin:8px 0}textarea{display:block;width:95%;height:100px}
.pair{display:flex;gap:20px}.panel{width:50%}.image{position:relative}.image img{width:100%;display:block}
svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
@media(max-width:800px){.pair{flex-direction:column}.panel{width:100%}}
.warning{color:#ffcb78}#status{white-space:pre-wrap}
</style>
<h1>${controls ? 'Luna polar investigation: filtering and neutral-normal controls' : all ? 'Guided polar comparisons: Luna and Mars' : 'First guided comparison: Mars north pole, Standard'}</h1>
<p class="warning">Screening exercise only. No texture changes. Final Viewer acceptance stays on hold.
The old baseline is not ground truth: it may itself contain polar artifacts.</p>
<p>Start with the dark gray overview, then switch the light direction. Yellow marks 85 degrees (treatment starts);
cyan marks 87 degrees (blend completes). Look through the annulus between them,
not at the guide lines themselves. A continuous ridge should not suddenly break,
and the selected image should not introduce a circular shading step.</p>
<p>Then choose the closer view: look for identifiable relief that disappears or becomes unnaturally
smooth in the selected image. Finish with albedo + relief to distinguish color texture
pinching from normal-map shading. These are possible symptoms, not confirmed defects.
Lighting, geometry, mipmapped filtering and framing are identical within each pair.</p>
<p class="warning">Diagnostic presentation: neutral #777777 material for gray relief, low ambient light,
and a directional light 82 degrees from the polar surface normal, from left or right.
Normal strength remains 1: no slope exaggeration or image contrast processing.
Some smooth areas may still have weak detail; darkness alone is not lost relief.
The earlier pale comparison and your unsure observation remain valid retained evidence.</p>
${
  controls
    ? `<p>For north pinching, compare the closer mipmapped and nearest views, then the neutral-normal control.
If spokes remain with a neutral normal, geometry/tangent/lighting effects need investigation.
If they disappear, that implicates sampled normal data or its interaction with tangents, not necessarily invented terrain.
Nearest filtering can itself introduce aliasing; it is not a preferred runtime setting.</p>
<p>For south softening, describe a particular crater or ridge and its clock-face location.
The selected treatment samples geodesic neighbors at the delivered grid spacing; smoothing is possible,
but reduced spoking alone is not proof of lost legitimate detail.</p>
<section><h2>Retained source-derived relief references</h2>
<p>These full-resolution DEM CPU views use a different projection, orientation, lighting and nearest sampling.
They are context only: do not compare pixel positions directly with the Three images or use them as a fitted ground truth.
They retain the original slope recipe's own polar limitations.</p>
<div class="pair"><section class="panel"><h3>North source DEM</h3><img style="width:100%" src="luna-north-source-reference.png" alt="Luna north source-derived CPU relief"></section>
<section class="panel"><h3>South source DEM</h3><img style="width:100%" src="luna-south-source-reference.png" alt="Luna south source-derived CPU relief"></section></div></section>`
    : `<p>Mars north Standard already has your verbal preference for geodesic treatment; it is included for reference,
not a request to repeat your first review. Save notes for each remaining body/pole/tier.
Compare both lighting directions and the closer views before assessing that group.</p>`
}
<label>Body / pole / tier <select id="group">
${groups.map((g) => `<option value="${g.id}">${g.body} / ${g.pole} / ${g.tier}</option>`).join('')}
</select></label>
<label>Comparison <select id="case">
${cases.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
</select></label>
<label><input id="guides" type="checkbox" checked> Show latitude guides</label>
<div class="pair">
<section class="panel"><h2 id="baseline-label">Earlier baseline</h2><div class="image"><img id="baseline" alt="Earlier normal treatment"><svg id="baseline-guides" viewBox="0 0 768 512"></svg></div></section>
<section class="panel"><h2 id="selected-label">Selected geodesic</h2><div class="image"><img id="selected" alt="Selected geodesic normal treatment"><svg id="selected-guides" viewBox="0 0 768 512"></svg></div></section>
</div>
<p>Switch guides off before judging a suspected ring. No pixel marking is required.
If you cannot identify a feature confidently, choose unsure rather than forcing a conclusion.</p>
<label>Observation <select id="decision">
<option value="unsure">Unsure / need guidance</option>
<option value="acceptable">No concerning new boundary or detail loss visible in this comparison</option>
<option value="boundary">Possible ring or abrupt relief change near the blend band</option>
<option value="detail-loss">Possible lost or excessively softened relief</option>
<option value="other">Other concern described in notes</option>
</select></label>
<label>Notes / location / uncertainty<textarea id="notes" placeholder="For example: a ridge at about 3 o'clock fades suddenly between the two guides."></textarea></label>
<button id="save">Save observation</button> <button id="export">Download observations</button>
<p id="status" role="status"></p>
<h2>Saved observations</h2><ul id="saved"></ul>
<script>
const cases = ${JSON.stringify(cases)};
const groups = ${JSON.stringify(groups)};
const versions = ${JSON.stringify(versions)};
const key = ${JSON.stringify(`polar-guide:${path.basename(output)}`)};
let records;
try { records=JSON.parse(localStorage.getItem(key)||'[]'); if(!Array.isArray(records)) throw Error('Invalid saved records'); }
catch(error){ document.getElementById('status').textContent='Saved data error: '+error.message; throw error; }
const byId=id=>document.getElementById(id);
function radius(latitude,fov) {
 const angle=(90-latitude)*Math.PI/180;
 return 256*Math.sin(angle)/((3.5-Math.cos(angle))*Math.tan(fov*Math.PI/360));
}
function update(){
 const entry=cases.find(c=>c.id===byId('case').value);
 const group=groups.find(g=>g.id===byId('group').value);
 byId('baseline-label').textContent='Earlier baseline: '+versions[group.body][0];
 byId('selected-label').textContent='Selected: '+versions[group.body][1]+' geodesic';
 for(const variant of ['baseline','selected']){
  byId(variant).src=group.id+'-'+entry.id+'-'+variant+'.png';
  const svg=byId(variant+'-guides'); svg.replaceChildren();
  svg.style.display=byId('guides').checked?'block':'none';
  for(const [latitude,color] of [[85,'#ffd44d'],[87,'#37e5ee']]){
   const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
   for(const [name,value] of Object.entries({cx:384,cy:256,r:radius(latitude,entry.fov),fill:'none',stroke:color,'stroke-width':1.5}))
    circle.setAttribute(name,String(value));
   svg.append(circle);
  }
 }
}
byId('case').onchange=update;byId('guides').onchange=update;byId('group').onchange=()=>{
 byId('notes').value='';byId('decision').value='unsure';update();
};
function renderSaved(){
 byId('saved').replaceChildren();
 for(const record of records){const item=document.createElement('li');
 item.textContent=record.group+' / '+record.case+': '+record.decision+' — '+record.notes;byId('saved').append(item);}
}
for(const variant of ['baseline','selected']) byId(variant).onerror=()=>{byId('status').textContent='Image failed to load: '+variant;};
byId('save').onclick=()=>{
 if(!byId('notes').value.trim()){byId('status').textContent='Please describe your observation or why you are unsure.';return;}
 const record={group:byId('group').value,case:byId('case').value,decision:byId('decision').value,notes:byId('notes').value.trim(),reviewedAt:new Date().toISOString()};
 try{localStorage.setItem(key,JSON.stringify([...records,record]));records.push(record);renderSaved();byId('status').textContent='Saved '+records.length+' observations. This does not close the review.';}
 catch(error){byId('status').textContent='Saving failed: '+error.message;}
};
byId('export').onclick=()=>{
 if(!records.length){byId('status').textContent='No saved observations. Click Save observation before downloading.';return;}
 const blob=new Blob([JSON.stringify({evidence:key,scope:${JSON.stringify(controls ? 'Luna north/south low/standard filter and neutral-normal investigation' : all ? 'Luna/Mars north/south low/standard polar screening' : 'Mars north Standard guided screening only')},groups,cases,records,gateStatus:'Requires further coverage and explicit acceptance'},null,2)],{type:'application/json'});
 const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='polar-observations.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(link.href),1000);
};
renderSaved();update();
</script></html>`;
await fs.writeFile(path.join(output, 'index.html'), html);
const references = [];
if (controls) {
  const sourceDirectory = path.resolve(process.argv[4]);
  const sourceRelative = path.relative(repository, sourceDirectory);
  assert(
    sourceRelative.startsWith(`..${path.sep}`) || path.isAbsolute(sourceRelative),
    'Source references must be external',
  );
  for (const pole of ['north', 'south']) {
    const source = path.join(sourceDirectory, `luna-${pole}-original-dem-cpu-relief.png`);
    const bytes = await fs.readFile(source);
    await fs.writeFile(path.join(output, `luna-${pole}-source-reference.png`), bytes);
    references.push({ file: path.basename(source), sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}
const hash = async (file) =>
  createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
const inventory = [];
for (const file of await fs.readdir(output)) {
  inventory.push({ file, sha256: await hash(path.join(output, file)) });
}
const inputs = [];
for (const body of [...new Set(groups.map((g) => g.body))]) {
  for (const version of versions[body]) {
    const tiers = [...new Set(groups.filter((g) => g.body === body).map((g) => g.tier))];
    for (const file of [
      'derivative-manifest.json',
      ...tiers.flatMap((tier) => [`${body}-${tier}-albedo.jpg`, `${body}-${tier}-normal.png`]),
    ]) {
      inputs.push({
        version,
        file,
        sha256: await hash(path.join(repository, 'assets', 'sol-textures', version, file)),
      });
    }
  }
}
await fs.writeFile(
  path.join(output, 'evidence-inventory.json'),
  JSON.stringify(
    {
      inventory,
      inputs,
      references,
      preparationScriptSha256: await hash(fileURLToPath(import.meta.url)),
      diagnosticScriptSha256: await hash(path.join(repository, 'tools', 'sol-textures', 'diagnostic', 'diagnostic.js')),
    },
    null,
    2,
  ),
);
console.log(
  `PASS: ${groups.length * cases.length * 2} matched images across ${groups.length} groups prepared at ${output}`,
);
