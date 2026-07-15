module.exports = {
  testTimeout: 30000,
  // Base MongoDB en mémoire : les tests ne touchent jamais une vraie base
  globalSetup:    '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  // Mock du service d'email (voir tests/setupMocks.js) : aucun test n'envoie
  // jamais de vrai email, quel que soit le chemin de code qu'il exerce.
  setupFilesAfterEnv: ['<rootDir>/tests/setupMocks.js'],
  // globalSetup/globalTeardown/setupMocks ne sont pas des suites de tests
  testPathIgnorePatterns: ['/node_modules/', '/tests/globalSetup.js', '/tests/globalTeardown.js', '/tests/setupMocks.js'],
};
