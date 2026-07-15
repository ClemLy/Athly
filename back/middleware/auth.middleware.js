// On importe jsonwebtoken pour vérifier les tokens
const jwt = require("jsonwebtoken");
const config = require("../config/env");

/**
 * Middleware d'authentification JWT
 * ----------------------------------
 * Ce middleware permet de protéger les routes qui nécessitent
 * que l'utilisateur soit connecté.
 *
 * Fonctionnement :
 * 1. Vérifie la présence d'un header Authorization contenant : "Bearer TOKEN"
 * 2. Vérifie que le token est valide (signature HS256 correcte, non expiré)
 * 3. Si valide → attache l'utilisateur décodé à req.user et continue la route
 * 4. Sinon → renvoie une erreur 401 (non autorisé)
 *
 * Sécurité :
 *  - Ne JAMAIS logger les headers (le Bearer token finirait dans les logs).
 *  - Ne JAMAIS renvoyer le détail de l'erreur JWT au client (fuite d'infos
 *    sur la vérification de signature).
 *  - Algorithme épinglé à HS256 : empêche la confusion d'algorithme
 *    (ex: token forgé en "none" ou RS256).
 */
const authMiddleware = (req, res, next) => {
  try {
    // Récupération du header Authorization envoyé par le front
    const authHeader = req.headers.authorization;

    // Si aucun token n'est fourni → accès refusé
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Accès refusé : token manquant." });
    }

    // Le token doit être sous la forme "Bearer TOKEN"
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Token invalide ou mal formaté." });
    }

    // Vérification signature + expiration avec la clé secrète du .env
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });

    // Attache les infos utilisateur au req pour les utiliser dans les routes
    req.user = decoded;

    // On continue vers le controller
    next();
  } catch (error) {
    // Log minimal : type d'erreur + route, jamais les headers ni le token
    console.warn(`🔒 [AUTH] ${error.name} sur ${req.method} ${req.originalUrl || req.url}`);
    return res.status(401).json({ success: false, message: "Token invalide ou expiré." });
  }
};

module.exports = authMiddleware;
