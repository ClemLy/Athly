const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    // Identité
    pseudo: { type: String, trim: true },
    name:   { type: String, trim: true }, // conservé pour rétrocompatibilité
    email: {
      type: String,
      required: [true, "L'e-mail est obligatoire"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Le mot de passe est obligatoire"],
    },

    // ── Vérification email ────────────────────────────────────────────────────
    isVerified:       { type: Boolean, default: false },
    verificationCode: { type: String },
    verifyAttempts:   { type: Number, default: 0 },   // protection brute-force OTP

    // ── Réinitialisation mot de passe ─────────────────────────────────────────
    resetPasswordCode: { type: String },

    // Expiration partagée (vérification email & reset mdp)
    codeExpires: { type: Date },

    // ── Profil physique ───────────────────────────────────────────────────────
    age:       { type: Number },
    sexe:      { type: String, enum: ["H", "F", "Autre"] },
    poids:     { type: Number },
    poidsCible:{ type: Number },
    taille:    { type: Number },
    niveauSportif: {
      type: String,
      enum: ["Débutant", "Intermédiaire", "Avancé"],
      default: "Débutant",
    },
    objectif: {
      type: String,
      enum: ["prise de masse", "perte de poids", "entretien", "force"],
    },
    rythme:     { type: Number, min: 1, max: 7 },
    equipements:{ type: [String], default: [] },

    // ── Gamification ──────────────────────────────────────────────────────────
    xp:    { type: Number, default: 0 },
    level: { type: Number, default: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
