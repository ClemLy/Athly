'use strict';

/**
 * Assainissement anti-injection NoSQL.
 *
 * Supprime récursivement les clés d'objet commençant par `$` ou contenant
 * un `.` dans body / params / query : c'est le vecteur des injections
 * d'opérateurs MongoDB (ex: { email: { $ne: null } } au login).
 *
 * On mutate les objets en place (sans réassigner req.query, qui est un
 * getter en Express 5). Les valeurs texte ne sont pas modifiées : React
 * échappe le HTML au rendu, et les schémas Joi valident les formats.
 * (express-mongo-sanitize est incompatible Express 5, d'où ce middleware.)
 */
function stripDangerousKeys(obj, depth = 0) {
  if (depth > 10 || obj === null || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      stripDangerousKeys(obj[key], depth + 1);
    }
  }
}

module.exports = function sanitizeMiddleware(req, _res, next) {
  try {
    stripDangerousKeys(req.body);
    stripDangerousKeys(req.params);
    stripDangerousKeys(req.query);
  } catch (_) {
    // Un échec d'assainissement ne doit jamais faire tomber la requête :
    // Joi et Mongoose restent les gardes-fous en aval.
  }
  next();
};
