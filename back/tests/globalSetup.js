'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');

/**
 * Démarre une instance MongoDB en mémoire avant toute la suite Jest.
 *
 * Sécurité : les tests font des deleteMany({}) — ils ne doivent JAMAIS
 * s'exécuter contre une vraie base. On écrase process.env.MONGO_URI ici,
 * avant que dotenv ne soit chargé (dotenv n'écrase pas une variable déjà
 * définie), donc l'URI du .env local est ignorée pendant les tests.
 */
module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create();

  process.env.MONGO_URI  = mongod.getUri('athly-test');
  process.env.NODE_ENV   = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'jest-only-secret';

  // Partagé avec globalTeardown (même process runner)
  globalThis.__MONGOD__ = mongod;
};
