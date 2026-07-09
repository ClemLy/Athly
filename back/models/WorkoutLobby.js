const mongoose = require("mongoose");

// -----------------------------------------------------
// Modèle "WorkoutLobby" (Section VII — Lobby Multi)
// -----------------------------------------------------
// Salon de séance synchronisée entre 2 à 5 athlètes. Chacun gère ses propres
// séries/poids côté client (résilience réseau) — le lobby ne sert qu'à
// synchroniser 3 moments clés : la mise en route (waiting → active dès que
// TOUS les membres sont 'ready'), et la clôture (active → completed dès que
// TOUS les membres sont 'finished'), moment où le bonus XP Multi est calculé
// (voir workoutLobby.controller.js).
//
// `memberCount` est dénormalisé (recalculé à chaque ajout de membre) pour
// permettre une requête simple "lobby complet à 5" côté trophées, sans agréger
// la taille du tableau `members` à chaque fois.
// -----------------------------------------------------

const MAX_MEMBERS = 5;

const LobbyMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["waiting", "ready", "finished"],
      default: "waiting",
    },
  },
  { _id: false }
);

const WorkoutLobbySchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: {
      type: [LobbyMemberSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_MEMBERS,
        message: `Un lobby ne peut pas dépasser ${MAX_MEMBERS} membres.`,
      },
    },
    memberCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["waiting", "active", "completed"],
      default: "waiting",
    },
    creationDate: { type: Date, default: Date.now },

    // Bonus XP Multi appliqué à la clôture (voir computeMultiBonusPercent) —
    // figé au moment où le dernier membre finit, pour un affichage cohérent
    // même si (en théorie) memberCount changeait après coup.
    xpBonusPercent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

WorkoutLobbySchema.index({ "members.user": 1, status: 1 });

module.exports = mongoose.model("WorkoutLobby", WorkoutLobbySchema);
module.exports.MAX_MEMBERS = MAX_MEMBERS;
