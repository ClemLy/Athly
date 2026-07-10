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

  updateRecordsShowcase: Joi.object({
    exerciseNames: Joi.array().items(Joi.string().max(80)).max(6).required(),
  }),

  registerPushToken: Joi.object({
    // null explicite = désenregistrement (permissions révoquées côté client)
    pushToken: Joi.string().max(200).allow(null).required(),
  }),

  // Synchronisation XP local → backend (voir user.service.js → syncXp).
  // Borne haute large mais finie : le clamp fin (xpForLevel(200)) est fait
  // côté service, cette borne Joi n'est qu'un garde-fou anti-payload absurde.
  syncXp: Joi.object({
    xp: Joi.number().integer().min(0).max(100000000).required(),
  }),
};

module.exports = userSchemas;