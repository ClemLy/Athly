const exerciseService = require("../services/exercise.service");

/**
 * AJOUTER UNE PERFORMANCE (RECORD)
 * Enregistre les séries, répétitions et poids pour un exercice donné dans une séance.
 */
exports.addRecord = async (req, res, next) => {
  try {
    // Appel au service pour créer l'entrée en base de données
    const record = await exerciseService.createRecord(req.user.id, req.body);
    
    res.status(201).json({ 
      success: true, 
      message: "Performance enregistrée !", 
      record 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * RÉCUPÉRER L'HISTORIQUE PAR EXERCICE
 * Utile pour afficher les graphiques de progression d'un mouvement spécifique (ex: Développé couché).
 */
exports.getExerciseHistory = async (req, res, next) => {
  try {
    // On récupère le nom de l'exercice via les paramètres de l'URL
    const { name } = req.params;
    const history = await exerciseService.getHistoryByExercise(req.user.id, name);
    
    res.status(200).json({ 
      success: true, 
      count: history.length, 
      history 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * RÉCUPÉRER LES EXERCICES D'UN WORKOUT
 * Permet d'afficher tous les poids/reps effectués durant une séance spécifique.
 */
exports.getWorkoutRecords = async (req, res, next) => {
  try {
    const { workoutId } = req.params;
    const records = await exerciseService.getRecordsByWorkout(req.user.id, workoutId);
    
    res.status(200).json({ 
      success: true, 
      count: records.length, 
      records 
    });
  } catch (error) {
    next(error);
  }
};