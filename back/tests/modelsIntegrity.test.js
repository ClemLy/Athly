'use strict';

// Ces tests ne font aucune requête à MongoDB.
// Ils vérifient uniquement que les modèles Mongoose peuvent être importés et
// que leurs schémas exposent les champs attendus.
// Un require() échouant (MODULE_NOT_FOUND) indique un modèle fantôme ou manquant.

// ─────────────────────────────────────────────────────────────────────────────
// Les 3 modèles réels
// ─────────────────────────────────────────────────────────────────────────────
describe('Import des 5 modèles réels', () => {
  it('User s\'importe sans erreur', () => {
    expect(() => require('../models/User')).not.toThrow();
  });

  it('Workout s\'importe sans erreur', () => {
    expect(() => require('../models/Workout')).not.toThrow();
  });

  it('ExerciseRecord s\'importe sans erreur', () => {
    expect(() => require('../models/ExerciseRecord')).not.toThrow();
  });

  it('Friendship s\'importe sans erreur', () => {
    expect(() => require('../models/Friendship')).not.toThrow();
  });

  it('StreakGroup s\'importe sans erreur', () => {
    expect(() => require('../models/StreakGroup')).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aucun modèle fantôme ne doit exister sur le disque
// ─────────────────────────────────────────────────────────────────────────────
describe('Absence des modèles fantômes', () => {
  const GHOST_MODELS = [
    'UserQuest',
    'RefreshToken',
    'WorkoutLog',
    'RitualLog',
    'UserProgress',
    'Notification',
  ];

  test.each(GHOST_MODELS)(
    'models/%s.js n\'existe pas (require lève MODULE_NOT_FOUND)',
    (name) => {
      expect(() => require(`../models/${name}`)).toThrow(/Cannot find module/);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Schéma User — champs V1 + V2
// ─────────────────────────────────────────────────────────────────────────────
describe('Schéma User', () => {
  let User;

  beforeAll(() => {
    User = require('../models/User');
  });

  it('exporte un modèle Mongoose', () => {
    expect(User).toBeDefined();
    expect(User.schema).toBeDefined();
  });

  const V1_PATHS = ['email', 'password', 'xp', 'level', 'isVerified'];
  test.each(V1_PATHS)('champ V1 "%s" présent', (field) => {
    expect(Object.keys(User.schema.paths)).toContain(field);
  });

  const V2_PATHS = ['birthdate', 'isBirthdateSet', 'rank', 'streakGels', 'totalWorkoutMinutes', 'referralCode', 'referredBy'];
  test.each(V2_PATHS)('champ V2 "%s" présent', (field) => {
    expect(Object.keys(User.schema.paths)).toContain(field);
  });

  it('email a la contrainte unique', () => {
    expect(User.schema.path('email').options.unique).toBe(true);
  });

  it('xp a une valeur par défaut de 0', () => {
    expect(User.schema.path('xp').defaultValue).toBe(0);
  });

  it('level a une valeur par défaut de 1', () => {
    expect(User.schema.path('level').defaultValue).toBe(1);
  });

  it('rank a "Novice" comme valeur par défaut', () => {
    expect(User.schema.path('rank').defaultValue).toBe('Novice');
  });

  it('isBirthdateSet a false comme valeur par défaut', () => {
    expect(User.schema.path('isBirthdateSet').defaultValue).toBe(false);
  });

  it('streakGels est limité à 3 maximum', () => {
    expect(User.schema.path('streakGels').options.max).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schéma Friendship — V2
// ─────────────────────────────────────────────────────────────────────────────
describe('Schéma Friendship', () => {
  let Friendship;

  beforeAll(() => {
    Friendship = require('../models/Friendship');
  });

  it('exporte un modèle Mongoose', () => {
    expect(Friendship).toBeDefined();
    expect(Friendship.schema).toBeDefined();
  });

  const REQUIRED_PATHS = ['requester', 'recipient', 'status', 'friendshipXp', 'friendshipLevel'];
  test.each(REQUIRED_PATHS)('le champ "%s" est présent', (field) => {
    expect(Object.keys(Friendship.schema.paths)).toContain(field);
  });

  it('status est restreint à pending / accepted / rejected', () => {
    const values = Friendship.schema.path('status').enumValues;
    expect(values).toEqual(expect.arrayContaining(['pending', 'accepted', 'rejected']));
  });

  it('status a "pending" comme valeur par défaut', () => {
    expect(Friendship.schema.path('status').defaultValue).toBe('pending');
  });

  it('friendshipLevel est limité à 5 maximum', () => {
    expect(Friendship.schema.path('friendshipLevel').options.max).toBe(5);
  });

  it('requester et recipient sont des ObjectId (ref User)', () => {
    expect(Friendship.schema.path('requester').options.ref).toBe('User');
    expect(Friendship.schema.path('recipient').options.ref).toBe('User');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schéma StreakGroup — V2
// ─────────────────────────────────────────────────────────────────────────────
describe('Schéma StreakGroup', () => {
  let StreakGroup;

  beforeAll(() => {
    StreakGroup = require('../models/StreakGroup');
  });

  it('exporte un modèle Mongoose', () => {
    expect(StreakGroup).toBeDefined();
    expect(StreakGroup.schema).toBeDefined();
  });

  const REQUIRED_PATHS = ['members', 'currentStreak', 'lastValidatedDate'];
  test.each(REQUIRED_PATHS)('le champ "%s" est présent', (field) => {
    expect(Object.keys(StreakGroup.schema.paths)).toContain(field);
  });

  it('currentStreak a 0 comme valeur par défaut', () => {
    expect(StreakGroup.schema.path('currentStreak').defaultValue).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schéma Workout — champs obligatoires
// ─────────────────────────────────────────────────────────────────────────────
describe('Schéma Workout', () => {
  let Workout;

  beforeAll(() => {
    Workout = require('../models/Workout');
  });

  it('exporte un modèle Mongoose', () => {
    expect(Workout).toBeDefined();
    expect(Workout.schema).toBeDefined();
  });

  const REQUIRED_PATHS = ['user', 'exercises', 'xpEarned', 'durationSeconds', 'status', 'notes'];

  test.each(REQUIRED_PATHS)('le champ "%s" est présent dans le schéma', (field) => {
    expect(Object.keys(Workout.schema.paths)).toContain(field);
  });

  it('la méthode d\'instance finalize() existe', () => {
    expect(typeof Workout.schema.methods.finalize).toBe('function');
  });

  it('la méthode d\'instance computeTotals() existe', () => {
    expect(typeof Workout.schema.methods.computeTotals).toBe('function');
  });

  it('xpEarned a une valeur par défaut de 0', () => {
    expect(Workout.schema.path('xpEarned').defaultValue).toBe(0);
  });

  it('status est restreint aux valeurs autorisées', () => {
    const enumValues = Workout.schema.path('status').enumValues;
    expect(enumValues).toContain('draft');
    expect(enumValues).toContain('in_progress');
    expect(enumValues).toContain('finished');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schéma ExerciseRecord — champs obligatoires
// ─────────────────────────────────────────────────────────────────────────────
describe('Schéma ExerciseRecord', () => {
  let ExerciseRecord;

  beforeAll(() => {
    ExerciseRecord = require('../models/ExerciseRecord');
  });

  it('exporte un modèle Mongoose', () => {
    expect(ExerciseRecord).toBeDefined();
    expect(ExerciseRecord.schema).toBeDefined();
  });

  const REQUIRED_PATHS = ['user', 'workout', 'exerciceNom', 'series'];

  test.each(REQUIRED_PATHS)('le champ "%s" est présent dans le schéma', (field) => {
    expect(Object.keys(ExerciseRecord.schema.paths)).toContain(field);
  });

  it('user et workout sont des ObjectId (ref)', () => {
    const userPath    = ExerciseRecord.schema.path('user');
    const workoutPath = ExerciseRecord.schema.path('workout');
    expect(userPath.options.ref).toBe('User');
    expect(workoutPath.options.ref).toBe('Workout');
  });
});
