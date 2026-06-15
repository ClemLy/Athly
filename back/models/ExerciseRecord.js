const mongoose = require("mongoose");

// -----------------------------------------------------
// Modèle "ExerciseRecord"
// -----------------------------------------------------
// Ce modèle stocke l'historique d'un exercice effectué :
// - poids
// - répétitions
// - séries
// - notes
//
// C'est le coeur du suivi de progression : il permet de
// calculer les PR, les graphes de progression, etc.
//
// Il est lié à :
// - un utilisateur
// - un workout
// -----------------------------------------------------

const ExerciseRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    workout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workout",
      required: true,
    },

    // Quel exercice a été fait
    exerciceNom: {
      type: String,
      required: true,
    },

    // Les séries réalisées
    series: [
      {
        poids: { type: Number, required: true },
        repetitions: { type: Number, required: true },
      },
    ],

    // Notes personnelles
    note: {
      type: String,
      trim: true,
    },

    // Pour la progression automatique
    recommandedNextWeight: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ExerciseRecord", ExerciseRecordSchema);