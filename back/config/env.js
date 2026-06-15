const dotenv = require("dotenv");
dotenv.config();

const config = {
  port:       process.env.PORT      || 4000,
  mongoUri:   process.env.MONGO_URI,
  jwtSecret:  process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES_IN || "1d",
  nodeEnv:    process.env.NODE_ENV  || "development",

  // ── Email / SMTP ────────────────────────────────────────────────────────────
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

if (!config.mongoUri) {
  throw new Error("ERREUR : MONGO_URI est manquante dans le fichier .env");
}

if (!config.jwtSecret) {
  throw new Error("ERREUR : JWT_SECRET est manquante dans le fichier .env");
}

module.exports = config;
