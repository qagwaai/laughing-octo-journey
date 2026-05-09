#!/usr/bin/env node
const fs = require('fs');
let src = fs.readFileSync('src/app/page/game/market-hub.spec.ts', 'utf8');

// Fix SpatialState objects: add frame and epochMs where missing
// Matches multi-line: { \n  solarSystemId: '...', \n  positionKm: {...}, \n }
src = src.replace(
  /\{\n(\t+)solarSystemId: '([^']+)',\n(\t+)positionKm: (\{[^}]+\}),?\n(\t+)\}/g,
  (match, i1, sysId, i2, posKm, ci) => {
    return `{\n${i1}solarSystemId: '${sysId}',\n${i2}frame: 'barycentric',\n${i2}positionKm: ${posKm},\n${i2}epochMs: 0,\n${ci}}`;
  },
);

// Fix ShipSummary objects in activeShip.set() that are missing name/model/tier
// Only when NOT already having those fields and NOT already using casts
const lines = src.split('\n');
const out = [];
let i = 0;
while (i < lines.length) {
  if (lines[i].includes('activeShip.set({') && !lines[i].includes('});')) {
    // Collect the multi-line object
    const start = i;
    const block = [];
    block.push(lines[i]);
    i++;
    while (i < lines.length && !lines[i].match(/^\t+\}\);$/)) {
      block.push(lines[i]);
      i++;
    }
    block.push(lines[i]); // the closing });
    i++;

    const blockStr = block.join('\n');
    const hasName = blockStr.includes('name:');
    const hasModel = blockStr.includes('model:');
    const hasTier = blockStr.includes('tier:');
    const hasCast = blockStr.includes('as any') || blockStr.includes('as ShipSummary');

    if (!hasCast && (!hasName || !hasModel || !hasTier)) {
      // Find the line with 'id:' and add missing fields after it
      let fixed = block.map((l) => l);
      const idIdx = fixed.findIndex((l) => l.includes("id: '") && !l.includes('characterId'));
      if (idIdx >= 0) {
        const indent = fixed[idIdx].match(/^(\t+)/)[1];
        const inserts = [];
        if (!hasName) inserts.push(`${indent}name: 'Test Ship',`);
        if (!hasModel) inserts.push(`${indent}model: 'Scavenger Pod',`);
        if (!hasTier) inserts.push(`${indent}tier: 1,`);
        fixed.splice(idIdx + 1, 0, ...inserts);
      }
      out.push(...fixed);
    } else {
      out.push(...block);
    }
  } else {
    out.push(lines[i]);
    i++;
  }
}
src = out.join('\n');
fs.writeFileSync('src/app/page/game/market-hub.spec.ts', src, 'utf8');
console.log('Done');
