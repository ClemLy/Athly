const workoutService = require('../services/workout.service');

exports.createWorkout = async (req, res, next) => {
  try {
    const workout = await workoutService.createWorkout(req.user.id, req.body);
    res.status(201).json({ success: true, workout });
  } catch (error) {
    next(error);
  }
};

exports.getAllMyWorkouts = async (req, res, next) => {
  try {
    const workouts = await workoutService.getMyWorkouts(req.user.id);
    res.status(200).json({ success: true, count: workouts.length, workouts });
  } catch (error) {
    next(error);
  }
};

exports.getOneWorkout = async (req, res, next) => {
  try {
    const workout = await workoutService.getWorkoutById(req.user.id, req.params.id);
    res.status(200).json({ success: true, workout });
  } catch (error) {
    next(error);
  }
};

exports.deleteWorkout = async (req, res, next) => {
  try {
    await workoutService.deleteWorkout(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: 'Séance supprimée' });
  } catch (error) {
    next(error);
  }
};

exports.createDraft = async (req, res, next) => {
  try {
    const workout = await workoutService.createDraft(req.user.id, req.body);
    res.status(201).json({ success: true, workout });
  } catch (error) {
    next(error);
  }
};

exports.updateDraft = async (req, res, next) => {
  try {
    const workout = await workoutService.updateDraft(req.user.id, req.params.id, req.body);
    res.status(200).json({ success: true, workout });
  } catch (error) {
    next(error);
  }
};

exports.completeWorkout = async (req, res, next) => {
  try {
    const { workout, stats } = await workoutService.completeWorkout(req.user.id, req.params.id);
    res.status(200).json({ success: true, workout, stats });
  } catch (error) {
    next(error);
  }
};

exports.finalizeWorkout = async (req, res, next) => {
  try {
    const { workout, stats } = await workoutService.finalizeWorkout(req.user.id, req.params.id, req.body || {});
    res.status(200).json({ success: true, workout, stats });
  } catch (error) {
    next(error);
  }
};
