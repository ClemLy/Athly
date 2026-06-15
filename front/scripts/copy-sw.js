// Script cross-platform : copie public/sw.js → dist/sw.js après expo export
const fs = require('fs');
const path = require('path');

const src  = path.join(__dirname, '..', 'public', 'sw.js');
const dest = path.join(__dirname, '..', 'dist',   'sw.js');

if (!fs.existsSync(path.dirname(dest))) {
  console.error('[copy-sw] Le dossier dist/ est absent — lance d\'abord expo export --platform web');
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log('[copy-sw] sw.js copié dans dist/');
