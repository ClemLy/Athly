// On importe jsonwebtoken pour vérifier les tokens
const jwt = require("jsonwebtoken");

/**
 * Middleware d'authentification JWT
 * ----------------------------------
 * Ce middleware permet de protéger les routes qui nécessitent
 * que l'utilisateur soit connecté.
 *
 * Fonctionnement :
 * 1. Vérifie la présence d'un header Authorization contenant : "Bearer TOKEN"
 * 2. Vérifie que le token est valide (non expiré, signature correcte)
 * 3. Si valide → attache l'utilisateur décodé à req.user et continue la route
 * 4. Sinon → renvoie une erreur 401 (non autorisé)
 */
const authMiddleware = (req, res, next) => {
  try {
    // Récupération du header Authorization envoyé par le front
    const authHeader = req.headers.authorization;

    // Si aucun token n'est fourni → accès refusé
    if (!authHeader) {
      console.error('Auth failed: missing Authorization header', {
        path: req.originalUrl || req.url,
        method: req.method,
        headers: req.headers,
      });
      return res.status(401).json({ message: "Accès refusé : token manquant." });
    }

    // Le token doit être sous la forme "Bearer TOKEN"
    const token = authHeader.split(" ")[1];

    if (!token) {
      console.error('Auth failed: token mal formaté', {
        path: req.originalUrl || req.url,
        method: req.method,
        headers: req.headers,
      });
      return res.status(401).json({ message: "Token invalide ou mal formaté." });
    }

    // Vérification du token avec la clé secrète située dans le .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attache les infos utilisateur au req pour les utiliser dans les routes
    req.user = decoded;

    // On continue vers le controller
    next();
  } catch (error) {
    console.error('Auth verification failed', {
      message: error && error.message,
      stack: error && error.stack,
      path: req.originalUrl || req.url,
      method: req.method,
      headers: req.headers,
    });
    return res.status(401).json({ message: "Token invalide ou expiré.", error: error && error.message });
  }
};

module.exports = authMiddleware;