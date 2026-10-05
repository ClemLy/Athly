const Joi = require('joi');

/**
 * Validation pour l'enregistrement d'une performance.
 */
const exerciseRecordSchema = Joi.object({
  workout: Joi.string().hex().length(24).required(), // Vérifie que c'est un ID MongoDB valide
  exerciceNom: Joi.string().trim().min(1).max(80).required(),
  series: Joi.array().items(
    Joi.object({
      poids: Joi.number().min(0).max(1000).required(),
      repetitions: Joi.number().integer().min(1).max(1000).required()
    })
  ).min(1).max(50).required(),
  note: Joi.string().max(500).allow('')
});

module.exports = { exerciseRecordSchema };