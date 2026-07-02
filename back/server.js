const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");

// ─── Filets de sécurité process-level ────────────────────────────────────────
// Une promesse rejetée non catchée ne doit jamais tuer le process silencieusement.
process.on("unhandledRejection", (reason) => {
  console.error("🔥 [unhandledRejection]", reason);
});

// Une exception synchrone non catchée laisse le process dans un état incertain :
// on log puis on sort proprement — l'orchestrateur (Render, PM2…) redémarre.
process.on("uncaughtException", (error) => {
  console.error("🔥 [uncaughtException]", error);
  process.exit(1);
});

// ─── Observabilité de la connexion MongoDB ───────────────────────────────────
// Si Atlas flanche en cours de route, Mongoose bufferise et retente tout seul ;
// les requêtes en échec remontent au error middleware (500 propre, pas de crash).
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  [MongoDB] connexion perdue — reconnexion automatique en cours…");
});
mongoose.connection.on("reconnected", () => {
  console.log("✅ [MongoDB] reconnecté.");
});
mongoose.connection.on("error", (err) => {
  console.error("❌ [MongoDB]", err.message);
});

/**
 * Démarrage du serveur
 */
const startServer = async () => {
  try {
    // 1. Connexion Base de données
    await connectDB();

    // 2. Écoute du serveur
    const server = app.listen(config.port, "0.0.0.0", () => {
      console.log(`🚀 Athly API démarrée sur le port ${config.port} (${config.nodeEnv})`);
    });

    // 3. Arrêt gracieux : on refuse les nouvelles connexions, on laisse
    //    les requêtes en cours se terminer, puis on ferme MongoDB.
    const shutdown = (signal) => {
      console.log(`\n${signal} reçu — arrêt gracieux…`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
      // Garde-fou : si des connexions traînent, on force après 10 s.
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Démarrage impossible :", error.message);
    process.exit(1);
  }
};

startServer();
