'use strict';

// Wrapper invoked by lint-staged from the git root. Extra args (staged file
// paths injected by lint-staged) land in process.argv[2+] and are intentionally
// ignored so jest always runs the full front-end test suite from athly-app/.
const { execSync } = require('child_process');
const path = require('path');

const appDir = path.join(__dirname, '..', 'athly-app');
execSync(
  'npx jest --config jest.config.js --runInBand --forceExit',
  { stdio: 'inherit', cwd: appDir }
);
