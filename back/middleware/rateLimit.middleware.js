'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config/env');

// Les tests Jest enchaînent des centaines de requêtes : on désactive le
// rate-limiting en environnement de test uniquement. Détection via
// JEST_WORKER_ID (défini par Jest dans chaque worker) plutôt que NODE_ENV :
// certains tests basculent temporairement config.nodeEnv vers 'production'
// (pour vérifier les routes devOnly), ce qui réactivait par erreur le limiter
// au milieu de la suite et provoquait des 429 non-déterministes. Évalué à
// chaque requête (pas figé au chargement du module).
const isTestEnv = () => process.env.JEST_WORKER_ID !== undefined || config.nodeEnv === 'test';

const standardOptions = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true, // RateLimit-* headers pour les clients
  legacyHeaders: false,
  skip: () => isTestEnv(),
  message: {
    success: false,
    status: 429,
    message: 'Trop de requêtes. Réessayez dans quelques minutes.',
  },
};

// ── Limiteur global : toutes les routes /api ─────────────────────────────────
// 300 requêtes / 15 min / IP — large pour un usage normal de l'app,
// bloquant pour un scraping ou un spam de scripts.
const globalLimiter = rateLimit({
  ...standardOptions,
  limit: 300,
});

// ── Limiteur strict : routes d'authentification ──────────────────────────────
// Clé IP + email ciblé → protège chaque compte du brute-force (login, OTP,
// reset password) même si l'attaquant tourne sur plusieurs comptes.
const authLimiter = rateLimit({
  ...standardOptions,
  limit: 20,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${ipKeyGenerator(req.ip)}|${email}`;
  },
  message: {
    success: false,
    status: 429,
    message: "Trop de tentatives d'authentification. Réessayez dans 15 minutes.",
  },
});

module.exports = { globalLimiter, authLimiter };
