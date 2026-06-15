'use strict';

// Wrapper invoked by lint-staged. Extra args (staged file paths injected
// by lint-staged) land in process.argv[2+] and are intentionally ignored
// so jest always runs the three fixed unit test suites.
const { execSync } = require('child_process');
execSync(
  'npx jest tests/levelHelpers.test.js tests/workoutAnticheat.test.js tests/modelsIntegrity.test.js --runInBand --forceExit',
  { stdio: 'inherit' }
);
