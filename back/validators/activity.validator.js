const Joi = require('joi');

const activitySchemas = {
  react: Joi.object({
    emoji: Joi.string().valid('bravo', 'respect', 'boo', 'jealous').required(),
  }),
};

module.exports = activitySchemas;
