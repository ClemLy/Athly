const Joi = require("joi");

// 8 caractères minimum avec au moins une lettre et un chiffre (recommandation
// CNIL pour un mot de passe protégé par limitation des tentatives). Plafond à
// 128 : bcrypt tronque silencieusement au-delà de 72 octets, et un mot de passe
// géant coûte cher à hacher (vecteur de déni de service).
const registerPwdRule = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[A-Za-zÀ-ÿ]/, "lettre")
  .pattern(/\d/, "chiffre")
  .required()
  .messages({
    "string.min":          "Le mot de passe doit contenir au moins 8 caractères.",
    "string.max":          "Le mot de passe ne peut pas dépasser 128 caractères.",
    "string.pattern.name": "Le mot de passe doit contenir au moins une lettre et un chiffre.",
    "string.empty":        "Le mot de passe est obligatoire.",
    "any.required":        "Le mot de passe est obligatoire.",
  });

const codeRule = Joi.string()
  .trim()
  .length(6)
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "string.length":       "Le code doit contenir exactement 6 chiffres.",
    "string.pattern.base": "Le code ne contient que des chiffres.",
    "string.empty":        "Entre le code reçu par email.",
    "any.required":        "Entre le code reçu par email.",
  });

// trim + lowercase : "Jean@Mail.fr " et "jean@mail.fr" désignent le même compte
const emailRule = Joi.string().trim().lowercase().max(254).email().required().messages({
  "string.email": "Cette adresse email n'est pas valide.",
  "string.max":   "Cette adresse email est trop longue.",
  "string.empty": "L'adresse email est obligatoire.",
  "any.required": "L'adresse email est obligatoire.",
});

const schemas = {
  register: Joi.object({
    // Pas de "#" (séparateur du tag Pseudo#1234), ni chevrons, ni caractères invisibles
    pseudo: Joi.string().trim().min(2).max(30).pattern(/^[^#<>]+$/).pattern(/^[\p{L}\p{N}\p{P}\p{S}\p{Zs}]+$/u, "printable").required().messages({
      "string.min":          "Le pseudo doit contenir au moins 2 caractères.",
      "string.max":          "Le pseudo ne peut pas dépasser 30 caractères.",
      "string.pattern.base": "Le pseudo ne peut pas contenir les caractères # < >.",
      "string.pattern.name": "Le pseudo contient des caractères non autorisés.",
      "string.empty":        "Le pseudo est obligatoire.",
      "any.required":        "Le pseudo est obligatoire.",
    }),
    email:    emailRule,
    password: registerPwdRule,
    // Parrainage optionnel à l'inscription — champ vide toléré (front envoie '')
    referralCode: Joi.string().trim().uppercase().max(20).allow("", null).messages({
      "string.max": "Ce code de parrainage est trop long.",
    }),
  }),

  login: Joi.object({
    email:    emailRule,
    password: Joi.string().max(128).required().messages({
      "string.empty": "Le mot de passe est obligatoire.",
      "string.max":   "Email ou mot de passe incorrect.",
      "any.required": "Le mot de passe est obligatoire.",
    }),
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

  googleLogin: Joi.object({
    idToken: Joi.string().max(4096).required().messages({
      "any.required": "La connexion avec Google a échoué. Réessaie.",
      "string.empty": "La connexion avec Google a échoué. Réessaie.",
    }),
  }),
};

module.exports = schemas;
