const express = require("express");
const router = express.Router();
const workoutController = require("../controllers/workout.controller");
const auth = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { workoutSchema, draftSchema, finalizeSchema } = require("../validators/workout.validator");

// Toutes les routes de workouts sont protégées par JWT
router.use(auth);

router.post("/", validate(workoutSchema), workoutController.createWorkout);
router.get("/", workoutController.getAllMyWorkouts);
router.get("/:id", workoutController.getOneWorkout);
router.delete("/:id", workoutController.deleteWorkout);

// Draft endpoints
router.post("/draft", validate(draftSchema), workoutController.createDraft);
router.patch("/:id/draft", validate(draftSchema), workoutController.updateDraft);

router.post("/:id/finalize",  validate(finalizeSchema), workoutController.finalizeWorkout);
router.post("/:id/complete",  workoutController.completeWorkout);

module.exports = router;