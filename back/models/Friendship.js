const mongoose = require("mongoose");

// ─── Modèle Friendship ───────────────────────────────────────────────────────
// Représente une relation d'amitié entre deux utilisateurs.
// Le niveau d'amitié (1→5) progresse de façon exponentielle sur ~4 mois via
// l'accumulation de friendshipXp (séances communes, interactions, défis).
//
// Convention de direction :
//   requester → a envoyé la demande
//   recipient → a reçu la demande
//
// Pour retrouver TOUTES les amitiés d'un user U (quel que soit le sens),
// la requête doit chercher { $or: [{ requester: U }, { recipient: U }] }.
// ─────────────────────────────────────────────────────────────────────────────

const FriendshipSchema = new mongoose.Schema(
  {
    requester: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    recipient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    status: {
      type:    String,
      enum:    ["pending", "accepted", "rejected"],
      default: "pending",
    },

    // XP cumulée entre ces deux amis (séances partagées, défis gagnés, etc.)
    friendshipXp: { type: Number, default: 0, min: 0 },

    // Niveau d'amitié actuel : 5 = Rareté Unique (lien de sang Athly)
    friendshipLevel: { type: Number, default: 1, min: 1, max: 5 },
  },
  { timestamps: true }
);

// ─── Index ────────────────────────────────────────────────────────────────────
// 1. Unicité directionnelle : empêche deux demandes A→B identiques.
//    La logique contrôleur doit vérifier B→A avant d'autoriser A→B.
FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// 2. Requêtes fréquentes : "toutes les demandes en attente reçues par X"
FriendshipSchema.index({ recipient: 1, status: 1 });

// 3. Requêtes fréquentes : "toutes les demandes envoyées par X"
FriendshipSchema.index({ requester: 1, status: 1 });

module.exports = mongoose.model("Friendship", FriendshipSchema);
