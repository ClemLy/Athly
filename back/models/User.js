const mongoose = require("mongoose");

// ─── Sous-schéma : trophée / succès débloqué ─────────────────────────────────
const AchievementEntrySchema = new mongoose.Schema(
  {
    achievementId: { type: String, required: true }, // clé du catalogue (ex: "BIRTHDAY_SET")
    unlockedAt:    { type: Date,   default: Date.now },
  },
  { _id: false }
);

// ─── Sous-schéma : item d'inventaire ─────────────────────────────────────────
// _id: false → pas d'ObjectId par item (économie de stockage)
const InventoryItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      required: true,
      enum: [
        "ENERGY_DRINK",        // Boisson Energisante  : +150 XP instantané
        "STREAK_FREEZE",       // Gel de streak        : charge 1 streakGel
        "SUPER_STREAK_FREEZE", // Pack de 3 gels       : remplit streakGels à 3
        "DOUBLE_XP",           // Boost Double XP
        "TRIPLE_XP",           // Boost Triple XP
        "QUINTUPLE_XP",        // Boost Quintuple XP
        "LEVEL_COUPON",        // Coupon de niveau     : +1 level
        "CHEST_KEY",           // Clé de coffre        : ouvre un coffre
        "PROFILE_FRAME_BLOOD_BOND", // Cadre cosmétique Unique — niveau d'amitié 5, hors coffres
        "FRAME_COLOR_BLOOD_SANG",   // Couleur cosmétique Unique — streak groupe 30j à 5 membres, hors coffres
        "THEME_UNLOCK_BLOOD_SANG",  // Thème cosmétique Unique — 100 coffres ouverts, hors coffres
      ],
    },
    rarity: {
      type: String,
      required: true,
      enum: ["common", "rare", "epic", "legendary", "unique"],
    },
    quantity: { type: Number, default: 1, min: 0 },
  },
  { _id: false }
);

// ─── Schéma principal User ────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    // ── Identité ──────────────────────────────────────────────────────────────
    pseudo: { type: String, trim: true },
    name:   { type: String, trim: true }, // conservé pour rétrocompatibilité V1

    // Tag numérique façon Discord (Section III) : "Pseudo#1234". Le pseudo
    // seul reste libre/non-unique (affiché partout dans l'app) — c'est le
    // COMBO { pseudo, discriminator } qui doit être unique, pour permettre
    // l'ajout d'ami sans ambiguïté (voir uniqueDiscriminator dans
    // auth.service.js et la recherche exacte dans friend.controller.js).
    // Optionnel au niveau schéma (comptes antérieurs à cette fonctionnalité,
    // backfillés lazily — voir user.service.js → getUserProfile) : l'index
    // unique ci-dessous n'agit que sur les documents qui en ont déjà un.
    discriminator: { type: String, match: /^\d{4}$/ },

    // ── Google OAuth (Section VIII) ───────────────────────────────────────────
    // `sub` (identifiant unique Google) du compte lié, si connecté via
    // "Se connecter avec Google" — voir auth.service.js → googleLogin.
    // null pour tous les comptes email/mot de passe classiques.
    googleId: { type: String, unique: true, sparse: true },

    // ── Compte de test God Mode (Section VII) ─────────────────────────────────
    // true uniquement pour les coéquipiers factices créés par
    // simulateLobbyInvite (debug.controller.js) — leur statut de Lobby Multi
    // est auto-progressé en miroir du vôtre (voir workoutLobby.controller.js),
    // pour tester le flux complet en solo sans second appareil.
    isTestBot: { type: Boolean, default: false },

    email: {
      type:      String,
      required:  [true, "L'e-mail est obligatoire"],
      unique:    true,
      trim:      true,
      lowercase: true,
    },
    password: {
      type:     String,
      required: [true, "Le mot de passe est obligatoire"],
    },

    // ── Vérification email ────────────────────────────────────────────────────
    isVerified:       { type: Boolean, default: false },
    verificationCode: { type: String },
    verifyAttempts:   { type: Number, default: 0 }, // protection brute-force OTP
    resetPasswordCode:{ type: String },
    codeExpires:      { type: Date },               // expire partagée (OTP & reset)

    // ── Profil physique ───────────────────────────────────────────────────────
    birthdate:      { type: Date },
    isBirthdateSet: { type: Boolean, default: false }, // verrouille la modif après 1ère saisie
    // Année (calendaire) où le cadeau d'anniversaire ("jour J") a été réclamé.
    // Empêche de le réclamer plusieurs fois la même année. null = jamais fêté.
    lastBirthdayRewardedYear: { type: Number, default: null },
    age:            { type: Number },
    sexe:           { type: String, enum: ["H", "F", "Autre"] },
    poids:          { type: Number },
    poidsCible:     { type: Number },
    taille:         { type: Number },
    niveauSportif: {
      type:    String,
      enum:    ["Débutant", "Intermédiaire", "Avancé"],
      default: "Débutant",
    },
    objectif: {
      type: String,
      enum: ["prise de masse", "perte de poids", "entretien", "force"],
    },
    rythme:     { type: Number, min: 1, max: 7 },
    equipements:{ type: [String], default: [] },

    // ── Gamification V1 ───────────────────────────────────────────────────────
    xp:    { type: Number, default: 0 },
    level: { type: Number, default: 1 },

    // ── Gamification V2 ───────────────────────────────────────────────────────
    // Rang calculé côté serveur à chaque gain de level (voir stats.service)
    rank: {
      type:    String,
      default: "Novice",
      enum: [
        "Novice",       // lvl  1–10
        "Initié",       // lvl 11–30
        "Athlète",      // lvl 31–50
        "Compétiteur",  // lvl 51–70
        "Warrior",      // lvl 71–90
        "Élite",        // lvl 91–110
        "Maître",       // lvl 111–140
        "Grand Maître", // lvl 141–170
        "Légende",      // lvl 171–199
        "ATHLY GOD",    // lvl 200+
      ],
    },

    // Inventaire d'objets (coffres, gels de streak, coupons…)
    inventory: { type: [InventoryItemSchema], default: [] },

    // Gels de streak actuellement chargés (max 3 simultanément)
    streakGels: { type: Number, default: 0, min: 0, max: 3 },

    // Cumul des minutes de séance — débloque des coffres à certains paliers
    totalWorkoutMinutes: { type: Number, default: 0, min: 0 },

    // Cumul du nombre de coffres ouverts (openChest) — indépendant des minutes
    // de séance : sert de condition de déblocage (trophées gradués, thème
    // cosmétique Rouge Sang Unique à 100 coffres).
    totalChestsOpened: { type: Number, default: 0, min: 0 },

    // Cumul du nombre de séances Multi terminées (lobby passé 'completed',
    // voir workoutLobby.controller.js → finishLobby) — condition des trophées
    // gradués MULTI_SESSIONS_5 / MULTI_SESSIONS_30 (reward.controller.js).
    totalMultiSessions: { type: Number, default: 0, min: 0 },

    // Cosmétiques Uniques définitivement débloqués (réclamés depuis
    // l'inventaire — voir inventory.controller.js → claimUniqueItem).
    // Clés libres du catalogue front (BorderPicker.js / profileThemes.js) :
    // ex. "FRAME_SHAPE_DRAGONFANG", "FRAME_COLOR_BLOODSANG", "THEME_BLOODSANG".
    unlockedCosmetics: { type: [String], default: [] },

    // ── Présence & notifications push ─────────────────────────────────────────
    // Token Expo Push (ExponentPushToken[...]) enregistré par le front après
    // acceptation des permissions — voir push.service.js. null = aucun appareil
    // enregistré (l'envoi est alors silencieusement ignoré, jamais une erreur).
    pushToken: { type: String, default: null },

    // Dernière activité connue (requête authentifiée quelconque) — alimente le
    // statut "Prêt" de la Météo des séances (voir groupStreak.controller.js).
    lastActiveAt: { type: Date, default: null },

    // Dernière consultation du flux d'activité "Taquineries & High-Fives" —
    // sert de curseur pour ne remonter que les événements nouveaux au
    // lancement de l'app (voir activity.controller.js).
    lastActivityFeedCheckAt: { type: Date, default: null },

    // ── Parrainage V2 ─────────────────────────────────────────────────────────
    // Code unique généré à la création du compte (ex: "ATH-X7K2P")
    referralCode: { type: String, unique: true, sparse: true },

    // ObjectId du parrain (null si compte non parrainé)
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ── Trophées / Succès V2 ─────────────────────────────────────────────────
    // Tableau des trophées débloqués. Le catalogue complet vit dans reward.controller.js.
    achievements: { type: [AchievementEntrySchema], default: [] },

    // Trophées mis en avant sur le profil public (max 3, contrôlé par Joi côté
    // validateur). Peut référencer un id du catalogue backend OU du miroir
    // local (LOCAL_TROPHY_CATALOG) — voir user.service.js → updateShowcase.
    showcasedAchievements: { type: [String], default: [] },

    // ── Records d'exercices mis en avant (Section III) ────────────────────────
    // Noms d'exercices (max 6, contrôlé par Joi côté validateur) choisis par
    // l'utilisateur pour son profil — remplace l'ancien top-5 automatique par
    // poids max, affiché identiquement sur son propre profil et son profil
    // public vu par ses amis (voir getFriendProfile dans friend.controller.js).
    showcasedRecords: { type: [String], default: [] },

    // ── Cadre de profil équipé ─────────────────────────────────────────────────
    // Synchronisé depuis le choix local (useAvatarFrame.js) pour que les amis
    // voient le même cadre sur le profil public. shapeId/colorId sont des clés
    // libres du catalogue front (BorderPicker.js) — pas d'enum ici pour ne pas
    // dupliquer/figer ce catalogue côté backend.
    equippedFrame: {
      shapeId: { type: String, default: 'circle', maxlength: 40, trim: true },
      colorId: { type: String, default: 'none',   maxlength: 40, trim: true },
    },
  },
  { timestamps: true }
);

// ─── Index ────────────────────────────────────────────────────────────────────
// email       : index unique déclaré inline (options du champ)
// referralCode: index unique + sparse déclaré inline (options du champ)
//               sparse = tolérance aux anciens documents V1 sans code

// Combo { pseudo, discriminator } unique — insensible à la casse (collation).
// partialFilterExpression : n'applique la contrainte qu'aux documents qui ONT
// déjà un discriminator, pour ne jamais bloquer les comptes pré-migration
// (potentiellement plusieurs pseudos identiques sans discriminator) tant
// qu'ils n'ont pas été backfillés (voir getUserProfile / scripts/backfillDiscriminators.js).
UserSchema.index(
  { pseudo: 1, discriminator: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { discriminator: { $type: "string" } },
  }
);

module.exports = mongoose.model("User", UserSchema);
