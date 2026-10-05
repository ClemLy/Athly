const Joi = require('joi');

/**
 * Validation pour la création/modification d'un Workout.
 */
const workoutSchema = Joi.object({
  titre: Joi.string().trim().min(3).max(80).required().messages({
    'string.min': "Le titre doit faire au moins 3 caractères.",
    'any.required': "Le titre est obligatoire."
  }),
  categorie: Joi.string().valid("Push", "Pull", "Legs", "Full Body", "Autre"),
  exercices: Joi.array().items(
    Joi.object({
      nom: Joi.string().max(80).required(),
      muscle: Joi.string().max(60).required(),
      equipement: Joi.string().max(60).allow('')
    })
  ).max(50)
});

// ── Brouillon de séance (auto-save pendant l'entraînement) ───────────────────
// Bornes larges pour ne jamais gêner un usage réel, mais finies pour qu'aucun
// client ne puisse stocker des structures arbitraires ou démesurées.
// Pendant la saisie, le front peut envoyer "" pour un champ vidé : accepté
// (Mongoose le stocke comme valeur vide), tant que ça reste court.
const numberLike = Joi.alternatives()
  .try(Joi.number().min(0).max(10000), Joi.string().max(12).allow(''))
  .allow(null);

const setRule = Joi.object({
  weight:    numberLike,
  reps:      numberLike,
  completed: Joi.boolean(),
  timestamp: Joi.date().allow(null),
}).unknown(true);

const exerciseEntryRule = Joi.object({
  name:         Joi.string().trim().max(120).required(),
  targetMuscle: Joi.string().max(80).allow('', null),
  equipment:    Joi.alternatives().try(Joi.array().items(Joi.string().max(60)).max(20), Joi.string().max(60).allow('')),
  sets:         Joi.array().items(setRule).max(60),
  notes:        Joi.string().max(1000).allow(''),
}).unknown(true);

const draftSchema = Joi.object({
  name:            Joi.string().trim().max(80).allow(''),
  exercises:       Joi.array().items(exerciseEntryRule).max(50),
  notes:           Joi.string().max(2000).allow(''),
  durationSeconds: Joi.number().min(0).max(24 * 3600),
  status:          Joi.string().valid('draft'),
});

const finalizeSchema = Joi.object({
  exercises:       Joi.array().items(exerciseEntryRule).max(50),
  notes:           Joi.string().max(2000).allow(''),
  durationSeconds: Joi.number().min(0).max(24 * 3600),
  shortSession:    Joi.boolean(),
});

module.exports = { workoutSchema, draftSchema, finalizeSchema };