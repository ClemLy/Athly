// ---------------------------------------------------------------------------------
// Connexion à MongoDB avec Mongoose
// ---------------------------------------------------------------------------------

const mongoose = require("mongoose");
const env = require("./env");

/**
 * Connecte l'application à MongoDB. En cas d'échec, affiche la cause réelle
 * (adresse IP non autorisée sur Atlas, mauvais identifiants, réseau coupé...)
 * puis arrête le serveur.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
  } catch (error) {
    console.error("[MongoDB] Connexion impossible :", error.message);
    if (/whitelist|IP|ReplicaSetNoPrimary|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(error.message)) {
      console.error("[MongoDB] Pistes : ton IP actuelle est-elle autorisée dans Atlas (Network Access) ? Es-tu connecté à internet ? L'URI de MONGO_URI est-elle correcte ?");
    }
    if (/auth/i.test(error.message)) {
      console.error("[MongoDB] Pistes : identifiant ou mot de passe de MONGO_URI incorrect (caractères spéciaux à encoder en %XX).");
    }
    process.exit(1);
  }
};

module.exports = connectDB;
