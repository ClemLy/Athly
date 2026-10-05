// La route demandée n'existe pas : réponse neutre, sans renvoyer l'URL reçue.
const notFoundMiddleware = (req, res, _next) => {
  res.status(404).json({
    success: false,
    status: 404,
    message: "Cette ressource n'existe pas.",
    code: "NOT_FOUND",
  });
};

module.exports = notFoundMiddleware;
