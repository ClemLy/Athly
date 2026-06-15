const app = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");

/**
 * Démarrage du serveur
 */
const startServer = async () => {
    try {
        // 1. Connexion Base de données
        await connectDB();

        // 2. Écoute du serveur
        app.listen(config.port,'0.0.0.0', () => {
            // server started
        });
    } catch (_error) {
        process.exit(1);
    }
};

startServer();