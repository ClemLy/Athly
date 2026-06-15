'use strict';

// Config Jest minimale pour tester les modules JS purs du front-end (data, utils).
// Utilise @babel/preset-env en mode Node pour transformer les ES modules
// sans déclencher les transforms React Native de babel-preset-expo.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
  // Forcer la transformation des fichiers du projet (pas des node_modules)
  transformIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['js'],
  testTimeout: 10000,
};
