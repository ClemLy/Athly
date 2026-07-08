const mongoose = require("mongoose");
const ExerciseRecord = require("../models/ExerciseRecord");
const User = require("../models/User");
const { recordActivityEvent } = require("./activity.service");

/**
 * Service gérant les performances (séries, reps, poids).
 */
class ExerciseService {
  /**
   * Enregistre une performance pour un exercice.
   *
   * Détection de PR (Section IV — flux d'activité) : compare le poids max
   * déjà enregistré par l'utilisateur sur cet exercice à celui de la
   * nouvelle performance. Si dépassé, publie un ActivityEvent "pr_broken"
   * visible par le groupe de streak (silencieux si l'utilisateur n'a pas
   * de groupe).
   */
  async createRecord(userId, recordData) {
    const previousMax = await this.getMaxWeightForExercise(userId, recordData.exerciceNom);

    // Correction de la typo : exerciceNom selon ton modèle
    const record = await ExerciseRecord.create({
      ...recordData,
      user: userId,
    });

    const newMax = Math.max(0, ...(record.series || []).map((s) => s.poids || 0));
    if (newMax > previousMax) {
      const user = await User.findById(userId).select('pseudo');
      const pseudo = user?.pseudo ?? 'Un membre';
      await recordActivityEvent(
        userId,
        'pr_broken',
        `${pseudo} a brisé son record au ${record.exerciceNom} !`,
        { exercise: record.exerciceNom, weight: newMax },
      );
    }

    return record;
  }

  /** Poids max historique déjà enregistré par l'utilisateur sur cet exercice. */
  async getMaxWeightForExercise(userId, exerciceNom) {
    const rows = await ExerciseRecord.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), exerciceNom } },
      { $unwind: '$series' },
      { $group: { _id: null, maxPoids: { $max: '$series.poids' } } },
    ]);
    return rows[0]?.maxPoids || 0;
  }

  /**
   * Récupère l'historique complet d'un exercice précis pour voir la progression.
   */
  async getHistoryByExercise(userId, exerciseName) {
    return await ExerciseRecord.find({
      user: userId,
      exerciceNom: exerciseName,
    }).sort({ createdAt: -1 });
  }

  /**
   * Récupère tous les records liés à une séance (Workout) précise.
   */
  async getRecordsByWorkout(userId, workoutId) {
    return await ExerciseRecord.find({
      user: userId,
      workout: workoutId,
    }).sort({ createdAt: 1 }); // Tri par ordre chronologique (du premier au dernier exercice fait)
  }
}

module.exports = new ExerciseService();