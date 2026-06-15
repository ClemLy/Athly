const express = require("express");
const router = express.Router();
const exerciseController = require("../controllers/exercise.controller");
const auth = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { exerciseRecordSchema } = require("../validators/exercise.validator");

/**
 * ROUTES EXERCICES / RECORDS
 * Gère le suivi des performances sportives.
 */

// Ajouter une nouvelle performance (ex: 3 séries de Squat)
router.post("/", auth, validate(exerciseRecordSchema), exerciseController.addRecord);

// Obtenir l'historique de progression d'un exercice précis par son nom
router.get("/history/:name", auth, exerciseController.getExerciseHistory);

// Obtenir tous les records liés à une séance (Workout) précise
router.get("/workout/:workoutId", auth, exerciseController.getWorkoutRecords);

module.exports = router;