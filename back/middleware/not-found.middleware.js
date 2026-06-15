const notFoundMiddleware = (req, res, _next) => {
  res.status(404).json({
    success: false,
    message: `Route [${req.method}] ${req.originalUrl} introuvable.`,
  });
};

module.exports = notFoundMiddleware;
