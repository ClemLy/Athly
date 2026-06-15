// ---------------------------------------------------------------------------------
// Connexion à MongoDB avec Mongoose + Récupération des variables d'environnement
// ---------------------------------------------------------------------------------

const mongoose = require("mongoose");
const env = require("./env");

/**
 * Fonction qui connecte l'application à MongoDB
 */
const connectDB = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    // MongoDB connected
  } catch (_error) {
    process.exit(1); // Stoppe le serveur en cas d’échec
  }
};

// On exporte la fonction pour l'utiliser dans server.js
module.exports = connectDB;