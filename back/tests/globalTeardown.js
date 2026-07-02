'use strict';

module.exports = async function globalTeardown() {
  if (globalThis.__MONGOD__) {
    await globalThis.__MONGOD__.stop();
  }
};
