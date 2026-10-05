// On importe jsonwebtoken pour vérifier les tokens
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const User = require("../models/User");

/**
 * Middleware d'authentification JWT
 * ----------------------------------
 * Protège les routes qui nécessitent un utilisateur connecté.
 *
 * Fonctionnement :
 * 1. Vérifie la présence d'un header Authorization "Bearer TOKEN"
 * 2. Vérifie la signature HS256 et l'expiration
 * 3. Vérifie que le compte existe toujours et que le token a été émis APRÈS
 *    le dernier changement de mot de passe : une réinitialisation ou une
 *    suppression de compte invalide immédiatement toutes les sessions ouvertes
 *    (sinon un token volé resterait valable jusqu'à son expiration).
 * 4. Attache { id } à req.user et continue
 *
 * Sécurité :
 *  - Ne JAMAIS logger les headers (le Bearer token finirait dans les logs).
 *  - Ne JAMAIS renvoyer le détail de l'erreur JWT au client.
 *  - Algorithme épinglé à HS256 : empêche la confusion d'algorithme.
 */
const SESSION_EXPIRED = {
  success: false,
  status: 401,
  message: "Ta session a expiré. Reconnecte-toi pour continuer.",
  code: "SESSION_EXPIRED",
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ ...SESSION_EXPIRED, message: "Connecte-toi pour accéder à cette page.", code: "AUTH_REQUIRED" });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json(SESSION_EXPIRED);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
  } catch (error) {
    // Log minimal : type d'erreur + route, jamais les headers ni le token
    console.warn(`[AUTH] ${error.name} sur ${req.method} ${req.originalUrl || req.url}`);
    return res.status(401).json(SESSION_EXPIRED);
  }

  try {
    const account = await User.findById(decoded.id).select("_id passwordChangedAt").lean();
    if (!account) {
      return res.status(401).json(SESSION_EXPIRED);
    }

    // iat est en secondes ; tolérance d'1 s pour le token émis dans la même
    // seconde que le changement de mot de passe (connexion juste après reset).
    if (account.passwordChangedAt && decoded.iat) {
      const changedAtSec = Math.floor(new Date(account.passwordChangedAt).getTime() / 1000);
      if (decoded.iat < changedAtSec - 1) {
        return res.status(401).json(SESSION_EXPIRED);
      }
    }
  } catch (error) {
    return next(error);
  }

  req.user = { id: String(decoded.id) };
  next();
};

module.exports = authMiddleware;
