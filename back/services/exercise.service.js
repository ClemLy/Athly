const ExerciseRecord = require("../models/ExerciseRecord");

/**
 * Service gérant les performances (séries, reps, poids).
 */
class ExerciseService {
  /**
   * Enregistre une performance pour un exercice.
   */
  async createRecord(userId, recordData) {
    // Correction de la typo : exerciceNom selon ton modèle
    const record = await ExerciseRecord.create({
      ...recordData,
      user: userId,
    });
    return record;
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