'use strict';

// ── Mocks Mongoose AVANT tout require du service ─────────────────────────────
// Jest intercepte les require('../models/...') dans workout.service.js et
// substitue nos fakes : aucune connexion à MongoDB n'est établie.
jest.mock('../models/Workout');
jest.mock('../models/User');

const WorkoutModel  = require('../models/Workout');
const UserModel     = require('../models/User');
const workoutService = require('../services/workout.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de construction des stubs
// ─────────────────────────────────────────────────────────────────────────────

/** Crée un faux document Workout dont finalize() renvoie baseXP. */
function makeWorkoutStub(baseXP = 1000) {
  return {
    durationSeconds: 0,
    createdAt: new Date(),
    finalize: jest.fn().mockResolvedValue({
      xp: baseXP,
      totalVolume: 5000,
      setsCompleted: 10,
    }),
  };
}

/** Crée un faux document User avec save(). */
function makeUserStub(currentXP = 0) {
  return {
    xp: currentXP,
    level: 0,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite principale
// ─────────────────────────────────────────────────────────────────────────────
describe('Anti-cheat temporel — finalizeWorkout()', () => {
  const FAKE_USER_ID    = 'user_abc123';
  const FAKE_WORKOUT_ID = 'workout_xyz456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Seuil 1 : session < 5 min (300 s) ────────────────────────────────────
  describe('Session trop courte (< 300 s)', () => {
    it('durationSeconds = 0 → 0 XP', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 0 },
      );

      expect(stats.xp).toBe(0);
    });

    it('durationSeconds = 150 s → 0 XP', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 150 },
      );

      expect(stats.xp).toBe(0);
    });

    it('durationSeconds = 299 s (juste sous le seuil) → 0 XP', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 299 },
      );

      expect(stats.xp).toBe(0);
    });

    it('shortSession: true quelle que soit la durée → 0 XP', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(makeUserStub());

      // Même une longue séance est pénalisée si shortSession: true est forcé
      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 1800, shortSession: true },
      );

      expect(stats.xp).toBe(0);
    });
  });

  // ── Seuil 2 : session entre 5 min et 15 min → XP ÷ 10 ───────────────────
  describe('Session courte [300 s ; 900 s[ → XP ÷ 10', () => {
    it('durationSeconds = 300 s (seuil bas inclus) → XP ÷ 10', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 300 },
      );

      expect(stats.xp).toBe(100); // 1000 / 10
    });

    it('durationSeconds = 600 s (milieu de la plage) → XP ÷ 10', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(500));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 600 },
      );

      expect(stats.xp).toBe(50); // 500 / 10
    });

    it('durationSeconds = 899 s (juste sous le seuil haut) → XP ÷ 10', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(200));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 899 },
      );

      expect(stats.xp).toBe(20); // Math.round(200 / 10)
    });

    it('XP réduit est arrondi correctement (Math.round)', async () => {
      // 333 / 10 = 33.3 → Math.round → 33
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(333));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 600 },
      );

      expect(stats.xp).toBe(33);
    });
  });

  // ── Séance normale : ≥ 900 s → XP plein ──────────────────────────────────
  describe('Session complète (≥ 900 s) → XP plein', () => {
    it('durationSeconds = 900 s (seuil haut inclus) → XP plein', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 900 },
      );

      expect(stats.xp).toBe(1000);
    });

    it('durationSeconds = 3 600 s (1 heure) → XP plein', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(2_500));
      UserModel.findById.mockResolvedValue(makeUserStub());

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 3_600 },
      );

      expect(stats.xp).toBe(2_500);
    });
  });

  // ── XP crédité sur le User ────────────────────────────────────────────────
  describe('Crédit XP utilisateur', () => {
    it('user.xp est incrémenté du montant post-anti-cheat', async () => {
      const user = makeUserStub(5_000);
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(user);

      await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 1200 },
      );

      expect(user.xp).toBe(6_000); // 5000 + 1000
      expect(user.save).toHaveBeenCalledTimes(1);
    });

    it('session courte : user.xp n\'est pas modifié (+ 0)', async () => {
      const user = makeUserStub(5_000);
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(user);

      await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 100 },
      );

      expect(user.xp).toBe(5_000);
    });

    it('user inexistant (null) : pas d\'erreur, stats retournées quand même', async () => {
      WorkoutModel.findOne.mockResolvedValue(makeWorkoutStub(1000));
      UserModel.findById.mockResolvedValue(null);

      const { stats } = await workoutService.finalizeWorkout(
        FAKE_USER_ID, FAKE_WORKOUT_ID, { durationSeconds: 1200 },
      );

      expect(stats.xp).toBe(1000);
      expect(stats.userXP).toBeNull();
      expect(stats.userLevel).toBeNull();
    });
  });

  // ── Workout introuvable ───────────────────────────────────────────────────
  it('workout introuvable → rejette avec une erreur', async () => {
    WorkoutModel.findOne.mockResolvedValue(null);

    await expect(
      workoutService.finalizeWorkout(FAKE_USER_ID, 'invalid_id', {}),
    ).rejects.toThrow('Séance introuvable');
  });
});
