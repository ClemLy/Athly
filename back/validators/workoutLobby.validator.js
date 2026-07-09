const Joi = require('joi');

const workoutLobbySchemas = {
  inviteToLobby: Joi.object({
    friendId: Joi.string().required(),
  }),
};

module.exports = workoutLobbySchemas;
