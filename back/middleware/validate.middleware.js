/**
 * Valide req.body contre un schéma Joi.
 *  - Champs inconnus refusés (comportement Joi par défaut).
 *  - En cas de succès, req.body est remplacé par la valeur NORMALISÉE par Joi
 *    (trim, lowercase, conversions de types) : les contrôleurs travaillent
 *    toujours sur des données propres.
 *  - En cas d'échec, chaque erreur est traduite en français lisible et
 *    rattachée à son champ (`fields`), pour que le front puisse l'afficher
 *    sous le bon input. Les messages déjà rédigés dans les schémas sont gardés.
 */

const FIELD_LABELS = {
  pseudo: "Le pseudo",
  name: "Le pseudo",
  email: "L'adresse email",
  password: "Le mot de passe",
  newPassword: "Le mot de passe",
  code: "Le code",
  referralCode: "Le code de parrainage",
  age: "L'âge",
  sexe: "Le sexe",
  poids: "Le poids",
  poidsCible: "Le poids cible",
  taille: "La taille",
  rythme: "Le nombre de séances par semaine",
  niveauSportif: "Le niveau sportif",
  objectif: "L'objectif",
  equipements: "La liste d'équipements",
  weight: "Le poids",
  date: "La date",
  titre: "Le nom de la séance",
  name_workout: "Le nom de la séance",
  exercises: "La liste d'exercices",
  exercices: "La liste d'exercices",
  notes: "La note",
  note: "La note",
  durationSeconds: "La durée",
  exerciceNom: "Le nom de l'exercice",
  series: "La liste de séries",
  friendId: "L'ami",
  pushToken: "Le jeton de notification",
};

function labelFor(detail) {
  const key = detail.context?.key;
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Champ imbriqué (ex : exercises[0].sets[2].weight) : on nomme le parent connu
  const known = (detail.path || []).find((p) => typeof p === "string" && FIELD_LABELS[p]);
  return known ? FIELD_LABELS[known] : "Une des informations";
}

function frenchMessage(detail) {
  // Message personnalisé défini dans le schéma (déjà en français)
  if (detail.message && !detail.message.startsWith('"')) return detail.message;

  const label = labelFor(detail);
  const limit = detail.context?.limit;
  switch (detail.type) {
    case "any.required":
    case "string.empty":
      return `${label} est obligatoire.`;
    case "number.base":
      return `${label} doit être un nombre.`;
    case "number.integer":
      return `${label} doit être un nombre entier.`;
    case "number.min":
      return `${label} doit être d'au moins ${limit}.`;
    case "number.max":
      return `${label} ne peut pas dépasser ${limit}.`;
    case "string.min":
      return `${label} doit contenir au moins ${limit} caractères.`;
    case "string.max":
      return `${label} ne peut pas dépasser ${limit} caractères.`;
    case "string.email":
      return "Cette adresse email n'est pas valide.";
    case "array.max":
      return `${label} contient trop d'éléments (${limit} maximum).`;
    case "array.min":
      return `${label} doit contenir au moins ${limit} élément${limit > 1 ? "s" : ""}.`;
    case "any.only":
      return `${label} contient une valeur non proposée.`;
    case "date.base":
    case "date.format":
    case "date.isoDate":
      return `${label} n'est pas une date valide.`;
    case "date.max":
      return `${label} ne peut pas être dans le futur.`;
    case "object.unknown":
      return "Cette information ne peut pas être modifiée ici.";
    default:
      return "Certaines informations envoyées ne sont pas valides.";
  }
}

module.exports = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body ?? {}, { abortEarly: false });
  if (error) {
    const fields = {};
    const messages = error.details.map((d) => {
      const msg = frenchMessage(d);
      const key = d.path?.[0];
      if (typeof key === "string" && !fields[key]) fields[key] = msg;
      return msg;
    });
    return res.status(400).json({
      success: false,
      status: 400,
      message: messages[0] || "Certaines informations envoyées ne sont pas valides.",
      code: "VALIDATION_ERROR",
      details: messages,
      fields,
    });
  }
  req.body = value;
  next();
};
