'use strict';

const config = require('../config/env');

/**
 * Bloque l'accès à une route en production (404, pour ne pas même révéler
 * que la route existe). Utilisé pour les endpoints d'outillage de test
 * (ex: synchronisation God Mode) qui ne doivent jamais être exposés
 * en dehors du développement/QA.
 */
module.exports = function devOnly(req, res, next) {
  if (config.nodeEnv === 'production') {
    return res.status(404).json({ success: false, message: 'Route introuvable.' });
  }
  next();
};
