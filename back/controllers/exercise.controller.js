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
/**
 * CLASSEMENT PAR EXERCICE (RÉSEAU D'AMIS)
 * GET /api/exercises/leaderboard?exercise=Développé couché
 *
 * Renvoie, pour un exercice donné, le meilleur poids soulevé par chaque
 * membre du réseau (moi + amis acceptés), trié décroissant. Le matching du
 * nom est insensible à la casse et aux accents (collation fr, strength 1)
 * pour tolérer les variations de saisie entre appareils.
 */
exports.getExerciseLeaderboard = async (req, res, next) => {
  try {
    const mongoose       = require("mongoose");
    const Friendship     = require("../models/Friendship");
    const User           = require("../models/User");
    const ExerciseRecord = require("../models/ExerciseRecord");

    const myId     = req.user.id;
    const exercise = typeof req.query.exercise === "string" ? req.query.exercise.trim() : "";

    if (exercise.length < 2) {
      const err = new Error("Le paramètre 'exercise' est obligatoire (2 caractères minimum).");
      err.statusCode = 400;
      return next(err);
    }

    // Réseau : moi + amis acceptés uniquement — pas de fuite hors du cercle social
    const friendships = await Friendship.find({
      $or: [{ requester: myId }, { recipient: myId }],
      status: "accepted",
    });
    const networkIds = [
      new mongoose.Types.ObjectId(myId),
      ...friendships.map((f) =>
        f.requester.toString() === myId ? f.recipient : f.requester,
      ),
    ];

    const rows = await ExerciseRecord.aggregate([
      { $match: { user: { $in: networkIds }, exerciceNom: exercise } },
      { $unwind: "$series" },
      { $group: {
        _id:      "$user",
        maxPoids: { $max: "$series.poids" },
        maxReps:  { $max: "$series.repetitions" },
      } },
      { $sort: { maxPoids: -1 } },
      { $limit: 20 },
    ]).collation({ locale: "fr", strength: 1 });

    // Enrichissement avec les champs publics (une seule requête)
    const users = await User.find({ _id: { $in: rows.map((r) => r._id) } })
      .select("pseudo level rank");
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    const leaderboard = rows
      .filter((r) => userById.has(r._id.toString()))
      .map((r, index) => ({
        position: index + 1,
        user:     userById.get(r._id.toString()),
        maxPoids: r.maxPoids,
        maxReps:  r.maxReps,
        isMe:     r._id.toString() === myId,
      }));

    return res.status(200).json({
      success: true,
      exercise,
      count:   leaderboard.length,
      leaderboard,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * MES RECORDS (TOUS EXERCICES)
 * GET /api/exercises/my-records
 *
 * Agrège, pour CHAQUE exercice que j'ai déjà pratiqué, mon meilleur poids et
 * mes répétitions associées — alimente le sélecteur "mettre en avant jusqu'à
 * 6 records" du profil (Section III) : l'utilisateur choisit parmi les
 * exercices qu'il a réellement faits, pas le catalogue entier.
 */
exports.getMyRecords = async (req, res, next) => {
  try {
    const mongoose       = require("mongoose");
    const ExerciseRecord = require("../models/ExerciseRecord");

    const rows = await ExerciseRecord.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
      { $unwind: "$series" },
      { $group: {
        _id:      "$exerciceNom",
        maxPoids: { $max: "$series.poids" },
        maxReps:  { $max: "$series.repetitions" },
      } },
      { $sort: { maxPoids: -1 } },
    ]);

    const records = rows.map((r) => ({ exercice: r._id, maxPoids: r.maxPoids, maxReps: r.maxReps }));

    return res.status(200).json({ success: true, count: records.length, records });
  } catch (error) {
    next(error);
  }
};
