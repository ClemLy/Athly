'use strict';

const config = require('../config/env');

/**
 * Bloque l'accès aux routes d'outillage de test (God Mode) hors développement.
 * Répond 404 pour ne pas même révéler que la route existe.
 *
 * Deux verrous :
 *  - NODE_ENV=production → toujours fermé.
 *  - Sur un hébergeur (Render expose RENDER=true), fermé par défaut même si
 *    NODE_ENV a été oublié : il faut un opt-in explicite ENABLE_DEBUG_ROUTES=true
 *    (ex : environnement de recette). Un oubli de configuration ne peut donc
 *    jamais exposer "donne-moi tous les objets" sur l'API publique.
 */
function debugRoutesAllowed() {
  if (config.nodeEnv === 'production') return false;
  if (process.env.RENDER && process.env.ENABLE_DEBUG_ROUTES !== 'true') return false;
  return true;
}

module.exports = function devOnly(req, res, next) {
  if (!debugRoutesAllowed()) {
    return res.status(404).json({ success: false, status: 404, message: "Cette ressource n'existe pas.", code: 'NOT_FOUND' });
  }
  next();
};

module.exports.debugRoutesAllowed = debugRoutesAllowed;
