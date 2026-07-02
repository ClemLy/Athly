const Workout = require("../models/Workout");
const User = require("../models/User");
const { levelFromXP } = require("../utils/levelHelpers");
const { addItemAtomic } = require("./inventory.service");

// ── Coffres à l'effort (Brique II) ───────────────────────────────────────────
// 1 coffre (CHEST_KEY) tous les CHEST_MINUTES_THRESHOLD minutes de séance
// légitime cumulées. Le drop est verrouillé sous le niveau 11 (Rang Initié),
// comme l'ouverture des coffres.
const CHEST_MINUTES_THRESHOLD = 300;
const MIN_LEVEL_FOR_CHEST_DROP = 11;

/**
 * Accumule atomiquement les minutes de séance et attribue les CHEST_KEY
 * de chaque palier de CHEST_MINUTES_THRESHOLD franchi.
 * Le $inc atomique garantit qu'aucun palier n'est compté deux fois même si
 * deux finalisations arrivent en même temps.
 */
async function accrueMinutesAndAwardChests(userId, minutes) {
  if (!minutes || minutes <= 0) return { chestsAwarded: 0, totalWorkoutMinutes: null };

  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { totalWorkoutMinutes: minutes } },
    { returnDocument: "after" },
  );
  if (!updated) return { chestsAwarded: 0, totalWorkoutMinutes: null };

  const total  = updated.totalWorkoutMinutes;
  const before = total - minutes;
  const crossed =
    Math.floor(total / CHEST_MINUTES_THRESHOLD) -
    Math.floor(before / CHEST_MINUTES_THRESHOLD);

  if (crossed <= 0 || updated.level < MIN_LEVEL_FOR_CHEST_DROP) {
    return { chestsAwarded: 0, totalWorkoutMinutes: total };
  }

  await addItemAtomic(userId, "CHEST_KEY", "common", crossed);
  return { chestsAwarded: crossed, totalWorkoutMinutes: total };
}

/**
 * Service gérant la création et la gestion des programmes/séances.
 */
class WorkoutService {
  /**
   * Crée une nouvelle séance d'entraînement.
   */
  async createWorkout(userId, workoutData) {
    const workout = await Workout.create({
      ...workoutData,
      user: userId,
    });
    return workout;
  }

  /**
   * Récupère toutes les séances d'un utilisateur spécifique.
   */
  async getMyWorkouts(userId) {
    // On trie par date de création décroissante (la plus récente d'abord)
    return await Workout.find({ user: userId }).sort({ createdAt: -1 });
  }

  /**
   * Récupère un workout par son ID avec vérification de propriété.
   */
  async getWorkoutById(userId, workoutId) {
    const workout = await Workout.findOne({ _id: workoutId, user: userId });
    if (!workout) throw new Error("Séance introuvable.");
    return workout;
  }

  /**
   * Supprime une séance.
   */
  async deleteWorkout(userId, workoutId) {
    const result = await Workout.findOneAndDelete({ _id: workoutId, user: userId });
    if (!result) throw new Error("Impossible de supprimer : séance introuvable.");
    return result;
  }

  /**
   * Crée une séance vide (draft) pour l'utilisateur
   */
  async createDraft(userId, initial = {}) {
    const workout = await Workout.create({
      user: userId,
      status: 'draft',
      ...initial,
    });
    return workout;
  }

  /**
   * Met à jour une draft (ou in_progress). Recalcule les totaux côté serveur.
   */
  async updateDraft(userId, workoutId, patch = {}) {
    const workout = await Workout.findOne({ _id: workoutId, user: userId });
    if (!workout) throw new Error('Séance introuvable');

    // autoriser uniquement certains champs
    if (patch.exercises) workout.exercises = patch.exercises;
    if (patch.notes !== undefined) workout.notes = patch.notes;
    if (patch.durationSeconds !== undefined) workout.durationSeconds = patch.durationSeconds;

    // toujours recalculer les totaux côté serveur pour garder cohérence
    workout.computeTotals();
    await workout.save();
    return workout;
  }

  /**
   * Complète une séance : XP = 100 (base) + 10 par exercice ayant au moins 1 set validé.
   */
  async completeWorkout(userId, workoutId) {
    const workout = await Workout.findOne({ _id: workoutId, user: userId });
    if (!workout) throw new Error('Séance introuvable');

    workout.computeTotals();

    const validatedExerciseCount = Array.isArray(workout.exercises)
      ? workout.exercises.filter((ex) =>
          Array.isArray(ex.sets) && ex.sets.some((s) => s.completed)
        ).length
      : 0;

    const xp = 100 + validatedExerciseCount * 10;

    workout.xpEarned = xp;
    workout.status = 'completed';
    workout.completedAt = new Date();
    if (!workout.durationSeconds) {
      const start = workout.createdAt ? new Date(workout.createdAt) : new Date();
      workout.durationSeconds = Math.max(0, Math.floor((new Date() - start) / 1000));
    }
    await workout.save();

    const user = await User.findById(userId);
    if (user) {
      user.xp = (user.xp || 0) + xp;
      user.level = levelFromXP(user.xp);
      await user.save();
    }

    return {
      workout,
      stats: {
        xp,
        validatedExerciseCount,
        totalVolume: workout.totalVolume,
        setsCompleted: workout.setsCompleted,
        durationSeconds: workout.durationSeconds,
        userXP: user ? user.xp : null,
        userLevel: user ? user.level : null,
      },
    };
  }

  /**
   * Finalise la séance : recalcule XP, applique l'anti-cheat temporel,
   * puis met à jour User.xp et User.level via la courbe exponentielle du front-end.
   *
   * Anti-cheat (miroir du front WorkoutScreen.js + buildLogFromWorkout) :
   *   - shortSession: true  OU  durée < 300 s  →  XP = 0
   *   - 300 s ≤ durée < 900 s                  →  XP ÷ 10
   *   - durée ≥ 900 s                           →  XP plein
   */
  async finalizeWorkout(userId, workoutId, options = {}) {
    const workout = await Workout.findOne({ _id: workoutId, user: userId });
    if (!workout) throw new Error('Séance introuvable');

    const result = await workout.finalize(options);

    // Durée effective : on prend la valeur du client si fournie, sinon celle du document
    const duration = typeof options.durationSeconds === 'number'
      ? options.durationSeconds
      : (workout.durationSeconds || 0);

    // ── Anti-cheat temporel ──────────────────────────────────────────────────
    // duration = 0 est traité comme une durée invalide/inconnue → 0 XP.
    let xp = result.xp;
    if (options.shortSession === true || duration < 300) {
      xp = 0;
    } else if (duration < 900) {
      xp = Math.round(xp / 10);
    }

    const user = await User.findById(userId);
    if (user) {
      user.xp = (user.xp || 0) + xp;
      user.level = levelFromXP(user.xp);
      await user.save();
    }

    // ── Coffres à l'effort ───────────────────────────────────────────────────
    // Seules les séances légitimes (non short-session, durée >= 300 s)
    // alimentent le compteur de minutes.
    let chestInfo = { chestsAwarded: 0, totalWorkoutMinutes: null };
    if (user && options.shortSession !== true && duration >= 300) {
      chestInfo = await accrueMinutesAndAwardChests(userId, Math.floor(duration / 60));
    }

    return {
      workout,
      stats: {
        ...result,
        xp,
        userXP:   user ? user.xp    : null,
        userLevel: user ? user.level : null,
        chestsAwarded:       chestInfo.chestsAwarded,
        totalWorkoutMinutes: chestInfo.totalWorkoutMinutes,
      },
    };
  }
}

module.exports = new WorkoutService();
