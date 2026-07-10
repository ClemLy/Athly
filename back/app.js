const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const config = require("./config/env");

// --- Importation des routes ---
const authRoutes     = require("./routes/auth.routes");
const userRoutes     = require("./routes/user.routes");
const workoutRoutes  = require("./routes/workout.routes");
const exerciseRoutes = require("./routes/exercise.routes");
const friendRoutes     = require("./routes/friend.routes");
const inventoryRoutes    = require("./routes/inventory.routes");
const groupStreakRoutes   = require("./routes/groupStreak.routes");
const rewardRoutes        = require("./routes/reward.routes");
const referralRoutes      = require("./routes/referral.routes");
const debugRoutes         = require("./routes/debug.routes");
const activityRoutes      = require("./routes/activity.routes");
const weightRoutes        = require("./routes/weight.routes");
const workoutLobbyRoutes  = require("./routes/workoutLobby.routes");
const profileRoutes       = require("./routes/profile.routes");

// --- Importation des middlewares ---
const errorMiddleware = require("./middleware/error.middleware");
const notFoundMiddleware = require("./middleware/not-found.middleware");
const sanitizeMiddleware = require("./middleware/sanitize.middleware");
const { globalLimiter, authLimiter } = require("./middleware/rateLimit.middleware");

const app = express();

// Render/reverse-proxy : nécessaire pour que req.ip soit la vraie IP client
// (sinon le rate-limiting par IP throttlerait tous les clients ensemble).
app.set("trust proxy", 1);

// --- Sécurité des headers HTTP (Helmet) ---
app.use(helmet());

// --- CORS ---
// CORS_ORIGINS (csv) définit l'allowlist. Les requêtes sans header Origin
// (app mobile native, curl, monitoring) ne sont pas soumises à CORS.
// Sans variable définie : comportement permissif (dev) + warning en prod.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0 && config.nodeEnv === "production") {
  console.warn("⚠️  CORS_ORIGINS non définie : CORS permissif en production.");
}

app.use(cors(
  allowedOrigins.length > 0
    ? {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
          return callback(new Error("Origine non autorisée par la politique CORS."));
        },
      }
    : {}
));

// --- Parsing avec limite de payload (anti-DoS par gros body) ---
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// --- Assainissement anti-injection NoSQL (après parsing, avant les routes) ---
app.use(sanitizeMiddleware);

// --- Logs d'accès (désactivés pendant les tests) ---
if (config.nodeEnv !== "test") {
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
}

// --- Réponses API jamais mises en cache par les intermédiaires ---
// (données utilisateur derrière auth — le cache offline est géré côté client)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// --- Rate limiting ---
app.use("/api", globalLimiter);
app.use("/api/auth", authLimiter);

// Route de santé pour le CI/CD
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", uptime: process.uptime() });
});

// --- Routes ---
app.use("/api/auth",      authRoutes);
app.use("/api/users",     userRoutes);
app.use("/api/workouts",  workoutRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/friends",    friendRoutes);
app.use("/api/inventory",  inventoryRoutes);
app.use("/api/groups",     groupStreakRoutes);
app.use("/api/rewards",    rewardRoutes);
app.use("/api/referral",   referralRoutes);
app.use("/api/debug",      debugRoutes);
app.use("/api/activity",   activityRoutes);
app.use("/api/weight",     weightRoutes);
app.use("/api/lobby",      workoutLobbyRoutes);
app.use("/api/profile",    profileRoutes);

// --- Gestion des erreurs ---
// Route 404
app.use(notFoundMiddleware);

// Middleware d'erreurs
app.use(errorMiddleware);

module.exports = app;
