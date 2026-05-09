#!/usr/bin/env node
const fs = require('fs');
let src = fs.readFileSync('src/app/page/game/market-hub.spec.ts', 'utf8');
const lines = src.split('\n');
let changed = 0;

let i = 0;
while (i < lines.length) {
  if (lines[i].includes('activeShip.set({')) {
    const block = [];
    let j = i;
    let depth = 0;
    let started = false;
    while (j < lines.length) {
      const l = lines[j];
      for (const ch of l) {
        if (ch === '{') {
          depth++;
          started = true;
        }
        if (ch === '}') depth--;
      }
      block.push(j);
      j++;
      if (started && depth <= 0) break;
    }
    const blockText = block.map((idx) => lines[idx]).join('\n');
    if (!blockText.includes('as any') && !blockText.includes('as ShipSummary')) {
      const hasName = blockText.includes('name:');
      const hasModel = blockText.includes('model:');
      const hasTier = blockText.includes('tier:');
      if (!hasName || !hasModel || !hasTier) {
        const closingIdx = block[block.length - 1];
        lines[closingIdx] = lines[closingIdx].replace(/\}\s*\);/, '} as any);');
        changed++;
      }
    }
    i = j;
  } else {
    i++;
  }
}

fs.writeFileSync('src/app/page/game/market-hub.spec.ts', lines.join('\n'), 'utf8');
console.log('Changed', changed, 'calls');
