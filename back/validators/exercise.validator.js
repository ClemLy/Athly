const Joi = require('joi');

/**
 * Validation pour l'enregistrement d'une performance.
 */
const exerciseRecordSchema = Joi.object({
  workout: Joi.string().hex().length(24).required(), // Vérifie que c'est un ID MongoDB valide
  exerciceNom: Joi.string().required(),
  series: Joi.array().items(
    Joi.object({
      poids: Joi.number().min(0).required(),
      repetitions: Joi.number().integer().min(1).required()
    })
  ).min(1).required(),
  note: Joi.string().allow('')
});

module.exports = { exerciseRecordSchema };