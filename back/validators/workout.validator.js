const Joi = require('joi');

/**
 * Validation pour la création/modification d'un Workout.
 */
const workoutSchema = Joi.object({
  titre: Joi.string().trim().min(3).required().messages({
    'string.min': "Le titre doit faire au moins 3 caractères.",
    'any.required': "Le titre est obligatoire."
  }),
  categorie: Joi.string().valid("Push", "Pull", "Legs", "Full Body", "Autre"),
  exercices: Joi.array().items(
    Joi.object({
      nom: Joi.string().required(),
      muscle: Joi.string().required(),
      equipement: Joi.string().allow('')
    })
  )
});

module.exports = { workoutSchema };