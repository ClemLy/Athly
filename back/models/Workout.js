const mongoose = require("mongoose");

// -----------------------------------------------------
// Modèle "Workout" (séance)
// - Représente une séance complète réalisée par un utilisateur
// - Contient une liste d'exercices, chaque exercice contient
//   un tableau de sets (historique poids / reps / completed)
// - Le serveur doit recalculer totalVolume et xpEarned lors
//   de la finalisation de la séance (méthode instance `finalize`).
// -----------------------------------------------------

const SetSchema = new mongoose.Schema(
  {
    weight: { type: Number, default: 0 },
    reps: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    timestamp: { type: Date },
  },
  { _id: false }
);

const ExerciseEntrySchema = new mongoose.Schema(
  {
    // Optionnel: référence vers catalogue d'exercices
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise" },
    name: { type: String, required: true },
    // muscle cible (pour stats futures)
    targetMuscle: { type: String, required: false },
    equipment: [{ type: String }],
    sets: { type: [SetSchema], default: [] },
    notes: { type: String, default: "" },
    videoUrl: { type: String, required: false },
  },
  { _id: true }
);

const WorkoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    name: { type: String, default: "Séance" },
    exercises: { type: [ExerciseEntrySchema], default: [] },
    durationSeconds: { type: Number, default: 0 },
    totalVolume: { type: Number, default: 0 },
    setsCompleted: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    status: { type: String, enum: ["draft", "in_progress", "finished", "completed"], default: "in_progress" },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Instance method : recalcule totalVolume et setsCompleted
WorkoutSchema.methods.computeTotals = function () {
  let totalVolume = 0;
  let setsCompleted = 0;

  if (Array.isArray(this.exercises)) {
    this.exercises.forEach((ex) => {
      if (!Array.isArray(ex.sets)) return;
      ex.sets.forEach((s) => {
        const w = Number(s.weight) || 0;
        const r = Number(s.reps) || 0;
        if (w && r) totalVolume += w * r;
        if (s.completed) setsCompleted += 1;
      });
    });
  }

  this.totalVolume = totalVolume;
  this.setsCompleted = setsCompleted;
  return { totalVolume, setsCompleted };
};

const FINAL_STATUSES = ["finished", "completed"];

/**
 * Réserve atomiquement la clôture de la séance : passe le statut à `nextStatus`
 * UNIQUEMENT si la séance n'est pas déjà terminée. Deux appels simultanés (double
 * tap, retry réseau) : un seul gagne, l'autre reçoit une erreur 409 — l'XP et
 * les coffres ne peuvent jamais être attribués deux fois pour la même séance.
 */
WorkoutSchema.methods.claimClosure = async function (nextStatus) {
  const res = await this.constructor.updateOne(
    { _id: this._id, status: { $nin: FINAL_STATUSES } },
    { $set: { status: nextStatus } },
  );
  if (!res || res.modifiedCount !== 1) {
    const err = new Error("Cette séance est déjà terminée.");
    err.statusCode = 409;
    err.code = "WORKOUT_ALREADY_FINISHED";
    throw err;
  }
  this.status = nextStatus;
};

// Instance method : calcule XP brut (avant anti-cheat) et finalise la séance.
// L'anti-cheat temporel et le calcul du niveau sont appliqués dans workout.service.js.
WorkoutSchema.methods.finalize = async function (options = {}) {
  await this.claimClosure("finished");

  // Recalculer toujours côté serveur
  const { totalVolume, setsCompleted } = this.computeTotals();

  // Formule XP : base 100 + 5 XP par série complétée
  const xp = 100 + setsCompleted * 5;

  this.xpEarned = xp;
  this.status = "finished";

  // si durationSeconds n'est pas renseigné, estimer sur createdAt
  if (!this.durationSeconds) {
    const start = this.createdAt ? new Date(this.createdAt) : new Date();
    const now = new Date();
    this.durationSeconds = Math.max(0, Math.floor((now - start) / 1000));
  }

  // possibilité d'ajouter des métadonnées additionnelles
  if (options.notes) this.notes = options.notes;

  await this.save();
  return { totalVolume, setsCompleted, xp };
};

// Index utile pour requêtes utilisateur + status
WorkoutSchema.index({ user: 1, status: 1, date: -1 });

module.exports = mongoose.model("Workout", WorkoutSchema);
module.exports.FINAL_STATUSES = FINAL_STATUSES;