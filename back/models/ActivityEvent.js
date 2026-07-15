const mongoose = require("mongoose");

// -----------------------------------------------------
// Modèle "ActivityEvent"
// -----------------------------------------------------
// Flux d'activité "Taquineries & High-Fives" (Section IV) : événements
// notables d'un membre de groupe (PR battu, coffre légendaire ouvert...),
// affichés aux autres membres du groupe au lancement de l'app avec des
// boutons de réaction à punchlines.
// -----------------------------------------------------

const ReactionSchema = new mongoose.Schema(
  {
    user:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, enum: ["bravo", "respect", "boo", "jealous"], required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const ActivityEventSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "StreakGroup", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Type d'événement déclencheur (extensible sans migration : ajouter un
    // type = ajouter un cas dans le hook + le libellé front, rien d'autre).
    type: { type: String, enum: ["pr_broken", "chest_legendary"], required: true },

    // Détails bruts (nom d'exercice + poids, ou rareté du coffre) — permet au
    // front de reconstruire un libellé sans dépendre uniquement de `message`.
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Libellé français prêt à afficher, calculé une fois à la création
    // (ex: "Léo a brisé son record au Squat !").
    message: { type: String, required: true },

    // Une réaction par utilisateur maximum (upsert géré côté service).
    reactions: { type: [ReactionSchema], default: [] },
  },
  { timestamps: true }
);

ActivityEventSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityEvent", ActivityEventSchema);
