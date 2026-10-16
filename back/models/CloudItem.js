const mongoose = require("mongoose");

// -----------------------------------------------------
// Modèle "CloudItem" : sauvegarde du compte
// -----------------------------------------------------
// L'app est "local-first" : l'historique des séances, les séances
// enregistrées, les exercices perso et quelques préférences vivent d'abord
// sur le téléphone. Ce modèle en garde une copie dans le compte, pour les
// retrouver sur un nouvel appareil ou après une réinstallation.
//
// Un document par élément, identifié par l'id généré sur le téléphone
// (`clientId`). Une suppression laisse une "pierre tombale" (deleted: true)
// pour que les autres appareils la répercutent au lieu de renvoyer l'élément.
// `data` est l'élément tel que l'app le stocke (le serveur ne l'interprète pas).
// -----------------------------------------------------

const CLOUD_KINDS = ["logs", "savedWorkouts", "customExercises", "prefs"];

const CloudItemSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind:     { type: String, enum: CLOUD_KINDS, required: true },
    clientId: { type: String, required: true, maxlength: 80 },
    data:     { type: mongoose.Schema.Types.Mixed, default: null },
    deleted:  { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false }
);

CloudItemSchema.index({ user: 1, kind: 1, clientId: 1 }, { unique: true });

module.exports = mongoose.model("CloudItem", CloudItemSchema);
module.exports.CLOUD_KINDS = CLOUD_KINDS;
