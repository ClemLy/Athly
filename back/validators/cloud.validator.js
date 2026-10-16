const Joi = require("joi");

// Ids générés par l'app (ex : "log-lx3k9-1a2b3c", "sw-…", "cx-…", "profileTheme")
const clientId = Joi.string().pattern(/^[A-Za-z0-9_-]{1,80}$/).messages({
  "string.pattern.base": "Un des éléments à sauvegarder a un identifiant invalide.",
});

const cloudSchemas = {
  // Un lot de modifications faites sur le téléphone : éléments créés ou
  // modifiés (puts) et éléments supprimés (dels). Le téléphone découpe en
  // lots pour rester sous la limite de taille des requêtes.
  sync: Joi.object({
    puts: Joi.array().items(
      Joi.object({ id: clientId.required() }).unknown(true)
    ).max(100).default([]),
    dels: Joi.array().items(clientId).max(500).default([]),
  }),
};

module.exports = cloudSchemas;
