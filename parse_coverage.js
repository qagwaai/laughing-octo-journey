const fs = require('fs');
const path = require('path');

function getCoverageFromHtml(htmlPath, baseDir = '') {
    const content = fs.readFileSync(htmlPath, 'utf8');
    const results = [];
    
    // Simple regex to match rows. 
    // This is fragile but often works for Istanbul HTML output.
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/g;
    const matches = content.match(rowRegex);
    if (!matches) return [];

    // Skip header
    for (let i = 1; i < matches.length; i++) {
        const row = matches[i];
        const fileMatch = row.match(/data-value="([^"]+)"/);
        if (!fileMatch) continue;
        
        const fileName = fileMatch[1];
        
        // Find all data-value attributes in the row
        const dataValues = [...row.matchAll(/data-value="([^"]+)"/g)].map(m => m[1]);
        
        // Columns: 0: File, 1: Pic, 2: Statements Pct, 3: Statements Abs, 4: Branches Pct
        const branchPct = parseFloat(dataValues[4]) || 0;
        
        const fullPath = path.join(baseDir, fileName).replace(/\\/g, '/');
        results.push({ path: fullPath, pct: branchPct });
    }
    return results;
}

function walkDir(dir, base = '') {
    let results = [];
    const list = fs.readdirSync(dir);
    
    if (list.includes('index.html')) {
        results = results.concat(getCoverageFromHtml(path.join(dir, 'index.html'), base));
    }

    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(fullPath, path.join(base, file)));
        }
    });

    return results;
}

const allResults = walkDir('coverage/ngt-template');

// Filter for files only (Istanbul uses data-value for the file/dir name)
// In the index.html, it lists files in the current dir and subdirs.
// We want to avoid duplicates if possible, and only keep actual source files.
const filesOnly = allResults.filter(r => r.path.match(/\.(ts|js|html|scss)$/));

// Sort: prioritize app/page/game, then by branch coverage ascending
filesOnly.sort((a, b) => {
    const aInGame = a.path.startsWith('app/page/game');
    const bInGame = b.path.startsWith('app/page/game');
    
    if (aInGame && !bInGame) return -1;
    if (!aInGame && bInGame) return 1;
    
    return a.pct - b.pct;
});

// Dedup (Istanbul might list them in multiple index.html files)
const seen = new Set();
const uniqueFiles = [];
for (const f of filesOnly) {
    if (!seen.has(f.path)) {
        seen.add(f.path);
        uniqueFiles.push(f);
    }
}

uniqueFiles.slice(0, 15).forEach(f => {
    console.log(`${f.path}: ${f.pct}%`);
});
