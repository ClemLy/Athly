const Joi = require('joi');

const weightSchemas = {
  logWeight: Joi.object({
    weight: Joi.number().min(20).max(400).required(),
    date:   Joi.date().iso().max('now').optional(),
  }),
};

module.exports = weightSchemas;
