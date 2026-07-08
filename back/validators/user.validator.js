const Joi = require('joi');

/**
 * SCHÉMAS DE VALIDATION UTILISATEUR
 * Assure que les données de profil respectent les formats attendus.
 */
const userSchemas = {
  updateProfile: Joi.object({
    name: Joi.string().min(2).max(50),
    age: Joi.number().min(12).max(100),
    sexe: Joi.string().valid("H", "F", "Autre"),
    poids: Joi.number().min(30).max(250),
    taille: Joi.number().min(100).max(250),
    poidsCible: Joi.number().min(30).max(250).allow(null),
    equipements: Joi.array().items(Joi.string()).default([]),
    niveauSportif: Joi.string().valid("Débutant", "Intermédiaire", "Avancé"),
    objectif: Joi.string().valid("prise de masse", "perte de poids", "entretien", "force"),
    rythme: Joi.number().min(1).max(7).allow(null)
  }),

  updateFrame: Joi.object({
    shapeId: Joi.string().max(40).required(),
    colorId: Joi.string().max(40).required(),
  }),

  updateShowcase: Joi.object({
    achievementIds: Joi.array().items(Joi.string().max(60)).max(3).required(),
  }),

  registerPushToken: Joi.object({
    // null explicite = désenregistrement (permissions révoquées côté client)
    pushToken: Joi.string().max(200).allow(null).required(),
  }),
};

module.exports = userSchemas;