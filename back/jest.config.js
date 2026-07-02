module.exports = {
  testTimeout: 30000,
  // Base MongoDB en mémoire : les tests ne touchent jamais une vraie base
  globalSetup:    '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  // globalSetup/globalTeardown ne sont pas des suites de tests
  testPathIgnorePatterns: ['/node_modules/', '/tests/globalSetup.js', '/tests/globalTeardown.js'],
};
