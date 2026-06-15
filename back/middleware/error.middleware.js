/**
 * MIDDLEWARE GLOBAL DE GESTION D'ERREURS
 * -------------------------------------
 * Ce middleware est le "filet de sécurité" de l'application.
 * Il intercepte toutes les erreurs passées via next(error).
 */
const errorMiddleware = (err, req, res, _next) => {
  // On définit un code statut par défaut (500 = Erreur Serveur)
  let statusCode = err.statusCode || 500;
  let message = err.message || "Une erreur interne est survenue sur le serveur.";

  // Cas spécifique : Erreur de validation Mongoose (ex: email manquant)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  // Cas spécifique : Erreur de Cast Mongoose (ex: ID MongoDB malformé)
  if (err.name === 'CastError') {
    statusCode = 404;
    message = `Ressource non trouvée. ID invalide : ${err.value}`;
  }

  // Cas spécifique : Doublon MongoDB (ex: l'email existe déjà)
  if (err.code === 11000) {
    statusCode = 400;
    message = "Cette donnée existe déjà dans notre base (doublon).";
  }

  // Log de l'erreur dans la console pour le développeur
  console.error(`❌ [ERROR] ${req.method} ${req.url} : ${message}`);

  // Réponse structurée renvoyée au Frontend React Native
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: message,
    // On affiche la pile d'erreur (stack) uniquement en mode développement
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorMiddleware;