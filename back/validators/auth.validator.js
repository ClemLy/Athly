const Joi = require("joi");

// Règle permissive — le frontend gère la guidance pédagogique via popup
const registerPwdRule = Joi.string()
  .min(6)
  .required()
  .messages({
    "string.min":   "Le mot de passe doit contenir au moins 6 caractères.",
    "any.required": "Le mot de passe est obligatoire.",
  });

const codeRule = Joi.string()
  .length(6)
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "string.length":  "Le code doit contenir exactement 6 chiffres.",
    "string.pattern.base": "Le code doit être numérique.",
    "any.required":   "Le code est obligatoire.",
  });

const emailRule = Joi.string().email().required().messages({
  "string.email": "L'adresse email doit être valide.",
  "any.required": "L'email est obligatoire.",
});

const schemas = {
  register: Joi.object({
    pseudo: Joi.string().min(2).max(50).required().messages({
      "string.min":  "Le pseudo doit contenir au moins 2 caractères.",
      "string.max":  "Le pseudo ne peut pas dépasser 50 caractères.",
      "any.required":"Le pseudo est obligatoire.",
    }),
    email:    emailRule,
    password: registerPwdRule,
  }),

  login: Joi.object({
    email:    emailRule,
    password: Joi.string().required().messages({ "any.required": "Le mot de passe est obligatoire." }),
  }),

  verifyEmail: Joi.object({
    email: emailRule,
    code:  codeRule,
  }),

  resendVerification: Joi.object({
    email: emailRule,
  }),

  forgotPassword: Joi.object({
    email: emailRule,
  }),

  resetPassword: Joi.object({
    email:       emailRule,
    code:        codeRule,
    newPassword: registerPwdRule,
  }),
};

module.exports = schemas;
