const mongoose = require("mongoose");

// -----------------------------------------------------
// Modèle "WeightHistory"
// -----------------------------------------------------
// Historique des pesées d'un utilisateur (Section VI — Suivi de poids).
// Une entrée par pesée enregistrée ; `user.poids` (User.js) reste le poids
// COURANT affiché ailleurs dans l'app, mis à jour en même temps qu'une
// entrée est créée ici (voir weight.controller.js → logWeight).
// -----------------------------------------------------

const WeightHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 20,
      max: 400,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Tri chronologique par utilisateur — requête la plus fréquente (courbe de poids).
WeightHistorySchema.index({ user: 1, date: 1 });

module.exports = mongoose.model("WeightHistory", WeightHistorySchema);
