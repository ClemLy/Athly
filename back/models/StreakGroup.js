const mongoose = require("mongoose");

// ─── Modèle StreakGroup ───────────────────────────────────────────────────────
// Groupe de streak collaboratif : la streak de groupe progresse uniquement
// si TOUS les membres ont validé une séance dans la journée.
//
// Limite de 5 membres max — appliquée dans le contrôleur (pas dans le schéma
// pour garder la logique métier centralisée et testable).
//
// Flux quotidien (cron) :
//   1. À minuit, le cron vérifie chaque groupe.
//   2. Si lastValidatedDate < hier → la streak est remise à 0.
//   3. Si tous les membres ont une séance du jour → currentStreak++ et
//      lastValidatedDate = aujourd'hui.
// ─────────────────────────────────────────────────────────────────────────────

const StreakGroupSchema = new mongoose.Schema(
  {
    // Nom optionnel choisi par les membres (ex: "Les Guerriers du Lundi")
    name: { type: String, trim: true },

    // Tableau des membres (ObjectId → ref User). Max 5 appliqué côté contrôleur.
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Invitations en attente (utilisateurs qui n'ont pas encore répondu)
    pendingInvites: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Compteur de la streak de groupe (jours consécutifs validés par tous)
    currentStreak: { type: Number, default: 0, min: 0 },

    // Dernier jour où tous les membres ont validé une séance.
    // null = groupe créé mais aucune journée validée encore.
    lastValidatedDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// ─── Index ────────────────────────────────────────────────────────────────────
// 1. Multikey index sur members : permet de trouver rapidement tous les groupes
//    d'un utilisateur avec { members: userId }.
StreakGroupSchema.index({ members: 1 });

// 2. Index sur lastValidatedDate : utilisé par le cron quotidien pour trouver
//    les groupes dont la streak est potentiellement à remettre à zéro.
StreakGroupSchema.index({ lastValidatedDate: 1 });

module.exports = mongoose.model("StreakGroup", StreakGroupSchema);
