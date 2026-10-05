const config = require("../config/env");

/**
 * MIDDLEWARE GLOBAL DE GESTION D'ERREURS
 * -------------------------------------
 * Filet de sécurité de l'application : intercepte toutes les erreurs passées
 * via next(error) et renvoie un JSON uniforme { success, status, message, code }.
 *
 * Règles :
 *  - Une erreur métier (statusCode < 500 posé volontairement) garde son message,
 *    déjà rédigé pour l'utilisateur final.
 *  - Une erreur technique (500) ne renvoie JAMAIS son message brut en
 *    production : il peut contenir des détails internes (chemins, requêtes,
 *    noms de champs). Le détail reste dans les logs serveur.
 *  - Les erreurs de bas niveau connues (JSON malformé, payload trop gros,
 *    ID mal formé, doublon, CORS) sont traduites en messages lisibles.
 */
const GENERIC_SERVER_MESSAGE =
  "Le serveur a rencontré un problème. Réessaie dans quelques instants.";

function normalize(err) {
  // JSON malformé (body-parser)
  if (err.type === "entity.parse.failed") {
    return { statusCode: 400, message: "La requête envoyée est illisible.", code: "BAD_JSON" };
  }
  // Payload au-delà de la limite express.json
  if (err.type === "entity.too.large") {
    return { statusCode: 413, message: "Les données envoyées sont trop volumineuses.", code: "PAYLOAD_TOO_LARGE" };
  }
  // Origine refusée par la politique CORS (voir app.js)
  if (err.code === "CORS_FORBIDDEN") {
    return { statusCode: 403, message: "Origine non autorisée.", code: "CORS_FORBIDDEN" };
  }
  // Validation Mongoose : messages définis dans les schémas (ou génériques)
  if (err.name === "ValidationError") {
    const first = Object.values(err.errors || {})[0];
    const raw = first?.message || "";
    // Les messages Mongoose par défaut sont en anglais ("Path `x` is required.") :
    // on ne garde que ceux rédigés en français dans les schémas.
    const readable = raw && !/^(Path|Validator|Cast to)/.test(raw)
      ? raw
      : "Certaines informations envoyées ne sont pas valides.";
    return { statusCode: 400, message: readable, code: "VALIDATION_ERROR" };
  }
  // ID MongoDB mal formé : on ne renvoie jamais la valeur reçue
  if (err.name === "CastError") {
    return { statusCode: 400, message: "Identifiant invalide.", code: "INVALID_ID" };
  }
  // Conflit de concurrence Mongoose (deux écritures simultanées sur un document)
  if (err.name === "VersionError") {
    return { statusCode: 409, message: "Cette action a déjà été prise en compte.", code: "CONFLICT" };
  }
  // Doublon d'index unique
  if (err.code === 11000) {
    return { statusCode: 409, message: "Cette donnée existe déjà.", code: "DUPLICATE" };
  }

  // Erreur métier : statut posé volontairement, message rédigé pour l'utilisateur
  // (y compris un 501 "fonction non disponible"). Sinon : erreur inattendue.
  const intentional = Number.isInteger(err.statusCode);
  return {
    statusCode: intentional ? err.statusCode : 500,
    message: err.message,
    code: typeof err.code === "string" ? err.code : undefined,
    unexpected: !intentional,
  };
}

const errorMiddleware = (err, req, res, _next) => {
  const { statusCode, message, code, unexpected } = normalize(err);
  const isServerError = Boolean(unexpected) && statusCode >= 500;

  if (isServerError) {
    // Le détail complet ne part QUE dans les logs serveur.
    console.error(`[ERROR] ${req.method} ${req.originalUrl || req.url} : ${err.stack || err.message}`);
  }

  // Détails techniques uniquement en développement local : jamais sur un
  // hébergeur (Render expose RENDER=true), même si NODE_ENV a été oublié.
  const exposeDetails = config.nodeEnv === "development" && !process.env.RENDER;

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: isServerError && !exposeDetails ? GENERIC_SERVER_MESSAGE : (message || GENERIC_SERVER_MESSAGE),
    ...(code && { code }),
    ...(exposeDetails && isServerError && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;
