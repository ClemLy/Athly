const crypto      = require("crypto");
const mongoose    = require("mongoose");
const User        = require("../models/User");
const Friendship  = require("../models/Friendship");
const bcrypt      = require("bcrypt");
const jwt         = require("jsonwebtoken");
const config      = require("../config/env");
const emailService = require("./email.service");
const { addItemAtomic } = require("./inventory.service");
const { containsProfanity } = require("../utils/profanityFilter");

const MAX_OTP_ATTEMPTS  = 5;
const CODE_TTL_VERIFY   = 10 * 60 * 1000; // 10 min
const CODE_TTL_RESET    = 15 * 60 * 1000; // 15 min
const CODE_RESEND_DELAY = 60 * 1000;      // 1 email de code par minute et par compte
const BCRYPT_ROUNDS     = 12;

// Hash bcrypt d'une valeur aléatoire, calculé au premier besoin : sert de
// leurre au login quand l'adresse n'a pas de compte.
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash(crypto.randomBytes(16).toString("hex"), BCRYPT_ROUNDS);
  return dummyHashPromise;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Code OTP à 6 chiffres tiré d'une source cryptographique (Math.random est
// prévisible et ne doit jamais servir à générer un secret).
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

// Les codes sont stockés hachés (HMAC lié au compte) : une fuite de la base ne
// révèle aucun code valide, et un hash ne peut pas être rejoué sur un autre compte.
function hashCode(userId, code) {
  return crypto
    .createHmac("sha256", config.jwtSecret)
    .update(`${userId}:${code}`)
    .digest("hex");
}

// Comparaison à temps constant : ne laisse pas deviner le code caractère par
// caractère via le temps de réponse.
function codeMatches(userId, submitted, storedHash) {
  if (!storedHash || typeof submitted !== "string") return false;
  const a = Buffer.from(hashCode(userId, submitted), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Anti-spam : au plus un email de code par minute et par compte. Quand la
// limite est atteinte, on ne renvoie PAS d'erreur spécifique (elle trahirait
// l'existence du compte) : la réponse générique est servie sans nouvel envoi.
// Le front affiche de son côté un compte à rebours avant de proposer le renvoi.
function canSendCode(user) {
  return !user.lastCodeSentAt || Date.now() - user.lastCodeSentAt.getTime() >= CODE_RESEND_DELAY;
}

// Code de parrainage lisible : ATH-XXXXX (sans 0/O/1/I ambigus).
// L'unicité est garantie par l'index unique+sparse du modèle : en cas de
// collision (improbable, 33^5 combinaisons), on retire.
const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateReferralCode() {
  let suffix = "";
  const bytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) suffix += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length];
  return `ATH-${suffix}`;
}

async function uniqueReferralCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const taken = await User.exists({ referralCode: code });
    if (!taken) return code;
  }
  // Repli quasi-impossible à atteindre : suffixe horodaté forcément unique
  return `ATH-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// Tag numérique façon Discord (Section III) : "Pseudo#1234". Contrairement au
// referralCode (unique globalement), le discriminator n'a besoin d'être
// unique QUE combiné au pseudo — 9000 combinaisons par pseudo suffisent
// largement avant toute collision réelle.
function generateDiscriminator() {
  return String(crypto.randomInt(1000, 10000));
}

async function uniqueDiscriminator(pseudo) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const discriminator = generateDiscriminator();
    const taken = await User.exists({ pseudo, discriminator })
      .collation({ locale: "en", strength: 2 });
    if (!taken) return discriminator;
  }
  // Repli quasi-impossible (20 tentatives sur 9000 combinaisons) : dernier
  // recours horodaté, tronqué à 4 chiffres.
  return String(Date.now()).slice(-4);
}

function makeToken(userId) {
  return jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: config.jwtExpires });
}

function httpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

// ── Service ───────────────────────────────────────────────────────────────────

class AuthService {

  // ── Inscription ────────────────────────────────────────────────────────────
  /**
   * Crée le compte. Si un `referralCode` (optionnel) est fourni :
   *  - Il doit être valide, sinon 400 REFERRAL_INVALID (l'utilisateur peut
   *    corriger sa saisie ou vider le champ — le compte n'est PAS créé).
   *  - Le filleul reçoit ses récompenses de bienvenue dès la création
   *    (1 STREAK_FREEZE + 1 LEVEL_COUPON), le parrain les mêmes + le trophée
   *    FIRST_REFERRAL, et les deux sont liés en amis "accepted" d'office.
   */
  async register(pseudo, email, password, referralCode = null) {
    if (containsProfanity(pseudo)) {
      throw httpError("Ce pseudo n'est pas autorisé. Choisis-en un autre.", 422, "PSEUDO_NOT_ALLOWED");
    }

    const existing = await User.findOne({ email });
    if (existing) throw httpError("Un compte existe déjà avec cette adresse email. Connecte-toi ou réinitialise ton mot de passe.", 409, "EMAIL_TAKEN");

    // ── Résolution du parrain AVANT création : un code invalide ne doit pas
    //    laisser un compte à moitié parrainé en base ────────────────────────
    let referrer = null;
    const cleanCode = typeof referralCode === "string" ? referralCode.trim().toUpperCase() : "";
    if (cleanCode) {
      referrer = await User.findOne({ referralCode: cleanCode }).select("_id");
      if (!referrer) {
        throw httpError("Ce code de parrainage n'existe pas. Vérifie-le ou laisse le champ vide.", 400, "REFERRAL_INVALID");
      }
    }

    const hashedPassword   = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationCode = generateCode();
    const userId           = new mongoose.Types.ObjectId();

    const newUser = await User.create({
      _id: userId,
      pseudo,
      name: pseudo,           // rétrocompatibilité
      email,
      password: hashedPassword,
      isVerified:      false,
      verificationCode: hashCode(userId, verificationCode),
      codeExpires:     new Date(Date.now() + CODE_TTL_VERIFY),
      lastCodeSentAt:  new Date(),
      verifyAttempts:  0,
      referralCode:    await uniqueReferralCode(),
      discriminator:   await uniqueDiscriminator(pseudo),
      ...(referrer && {
        referredBy: referrer._id,
        // Récompenses de bienvenue du filleul, directement à la création
        inventory: [
          { itemType: "STREAK_FREEZE", rarity: "rare",      quantity: 1 },
          { itemType: "LEVEL_COUPON",  rarity: "legendary", quantity: 1 },
        ],
      }),
    });

    // ── Effets côté parrain (best-effort : ne bloque jamais l'inscription) ──
    if (referrer) {
      try {
        await addItemAtomic(referrer._id, "STREAK_FREEZE", "rare", 1);
        await addItemAtomic(referrer._id, "LEVEL_COUPON", "legendary", 1);

        // Liés en amis d'office — le parrainage EST la preuve de la relation
        await Friendship.create({
          requester: referrer._id,
          recipient: newUser._id,
          status:    "accepted",
        });

        // Trophée FIRST_REFERRAL du parrain (require tardif : évite le cycle
        // auth.service → reward.controller → … au chargement des modules)
        const { checkAndUnlockAchievements } = require("../controllers/reward.controller");
        await checkAndUnlockAchievements(referrer._id.toString());

        // Titre REFERRAL_EARLY ("L'Ancien") du FILLEUL — lié dès l'inscription.
        const { checkAndUnlockTitles } = require("../controllers/title.controller");
        await checkAndUnlockTitles(newUser._id.toString());
      } catch (err) {
        console.error("[register] Récompenses de parrainage partielles :", err.message);
      }
    }

    // Envoi non-bloquant : un échec SMTP ne plante pas la réponse
    emailService.sendVerificationEmail(email, verificationCode).catch(err =>
      console.error("[register] Email de vérification :", err.message)
    );

    return {
      message:  "Compte créé. Vérifie ta boîte mail.",
      email,
      referred: Boolean(referrer),
    };
  }

  // ── Connexion ──────────────────────────────────────────────────────────────
  async login(email, password) {
    const user = await User.findOne({ email });
    if (!user) {
      // Hash factice : même temps de réponse que pour un compte existant,
      // pour ne pas révéler par le chronomètre quelles adresses sont inscrites.
      await bcrypt.compare(password, await getDummyHash());
      throw httpError("Email ou mot de passe incorrect.", 401, "INVALID_CREDENTIALS");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw httpError("Email ou mot de passe incorrect.", 401, "INVALID_CREDENTIALS");

    if (!user.isVerified) {
      // Nouveau code seulement si le précédent date de plus d'une minute :
      // des tentatives de connexion répétées ne doivent pas inonder la boîte mail.
      if (canSendCode(user)) {
        const verificationCode = generateCode();
        user.verificationCode  = hashCode(user._id, verificationCode);
        user.codeExpires       = new Date(Date.now() + CODE_TTL_VERIFY);
        user.lastCodeSentAt    = new Date();
        user.verifyAttempts    = 0;
        await user.save();

        emailService.sendVerificationEmail(user.email, verificationCode).catch(err =>
          console.error("[login] Renvoi du code :", err.message)
        );
      }

      throw httpError(
        "Ton adresse email n'est pas encore confirmée. Entre le code à 6 chiffres reçu par email.",
        403,
        "EMAIL_NOT_VERIFIED"
      );
    }

    const token = makeToken(user._id);
    return {
      token,
      user: {
        id:    user._id,
        pseudo: user.pseudo || user.name,
        discriminator: user.discriminator,
        email: user.email,
        level: user.level,
      },
    };
  }

  // ── Connexion Google OAuth (Section VIII) ─────────────────────────────────
  /**
   * Connexion en un clic via Google : le client (app mobile) obtient un
   * `idToken` via expo-auth-session / Google Sign-In, l'envoie ici pour
   * vérification côté serveur (jamais confiance en un payload décodé côté
   * client, qui pourrait être falsifié).
   *
   * Compte trouvé par `googleId` → connexion directe.
   * Sinon par `email` (compte déjà créé au mot de passe) → on lie googleId à
   * ce compte existant plutôt que d'en créer un doublon.
   * Sinon → création d'un nouveau compte (email déjà vérifié par Google,
   * mot de passe aléatoire jamais utilisable pour se connecter autrement).
   */
  async googleLogin(idToken) {
    if (!config.googleClientIds.length) {
      throw httpError("La connexion avec Google n'est pas encore disponible. Utilise ton email et ton mot de passe.", 501, "GOOGLE_OAUTH_NOT_CONFIGURED");
    }
    if (!idToken) {
      throw httpError("idToken manquant.", 400, "GOOGLE_TOKEN_MISSING");
    }

    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client();

    let payload;
    try {
      // audience accepte un tableau : le token peut avoir été émis pour
      // n'importe lequel des Client IDs configurés (iOS/Android/Web/Expo).
      const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientIds });
      payload = ticket.getPayload();
    } catch (_err) {
      throw httpError("La connexion avec Google a échoué. Réessaie.", 401, "GOOGLE_TOKEN_INVALID");
    }

    if (!payload?.sub || !payload?.email) {
      throw httpError("Token Google invalide.", 401, "GOOGLE_TOKEN_INVALID");
    }

    // Sans email vérifié par Google, lier ce compte à un compte Athly existant
    // portant la même adresse permettrait une prise de contrôle de compte.
    if (payload.email_verified !== true) {
      throw httpError("Ton adresse Google n'est pas vérifiée. Vérifie-la chez Google puis réessaie.", 401, "GOOGLE_EMAIL_UNVERIFIED");
    }

    let user = await User.findOne({ googleId: payload.sub });

    if (!user) {
      user = await User.findOne({ email: payload.email.toLowerCase() });
      if (user) {
        user.googleId = payload.sub;
        if (!user.isVerified) user.isVerified = true; // Google a déjà vérifié cet email
        await user.save();
      }
    }

    if (!user) {
      const pseudo = (payload.name || payload.email.split("@")[0]).slice(0, 50);
      const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), BCRYPT_ROUNDS);

      user = await User.create({
        pseudo,
        name: pseudo,
        email: payload.email.toLowerCase(),
        password: randomPassword,
        isVerified: true,
        googleId: payload.sub,
        referralCode: await uniqueReferralCode(),
        discriminator: await uniqueDiscriminator(pseudo),
      });
    }

    const token = makeToken(user._id);
    return {
      token,
      user: {
        id: user._id,
        pseudo: user.pseudo || user.name,
        discriminator: user.discriminator,
        email: user.email,
        level: user.level,
      },
    };
  }

  // ── Vérification email ─────────────────────────────────────────────────────
  async verifyEmail(email, code) {
    const user = await User.findOne({ email });
    // Même réponse qu'un mauvais code : ne révèle pas si l'adresse a un compte.
    if (!user) throw httpError("Ce code n'est pas valide. Vérifie-le ou demande-en un nouveau.", 400, "INVALID_CODE");

    if (user.isVerified) throw httpError("Ce compte est déjà confirmé. Tu peux te connecter.", 400, "ALREADY_VERIFIED");

    // Brute-force : max MAX_OTP_ATTEMPTS tentatives
    if (user.verifyAttempts >= MAX_OTP_ATTEMPTS) {
      throw httpError(
        "Trop de codes erronés. Demande un nouveau code pour réessayer.",
        429,
        "TOO_MANY_ATTEMPTS"
      );
    }

    // Expiration
    if (!user.codeExpires || user.codeExpires < new Date()) {
      throw httpError("Ce code a expiré. Demande un nouveau code.", 400, "CODE_EXPIRED");
    }

    // Mauvais code → incrémenter le compteur (atomique : deux essais simultanés comptent double)
    if (!codeMatches(user._id, code, user.verificationCode)) {
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { verifyAttempts: 1 } },
        { returnDocument: "after" }
      ).select("verifyAttempts");
      const remaining = Math.max(0, MAX_OTP_ATTEMPTS - (updated?.verifyAttempts ?? MAX_OTP_ATTEMPTS));
      throw httpError(
        remaining > 0
          ? `Ce code n'est pas le bon. Il te reste ${remaining} essai${remaining > 1 ? "s" : ""}.`
          : "Trop de codes erronés. Demande un nouveau code pour réessayer.",
        400,
        "INVALID_CODE"
      );
    }

    // Succès : activer le compte et nettoyer les champs OTP
    user.isVerified       = true;
    user.verificationCode = undefined;
    user.codeExpires      = undefined;
    user.lastCodeSentAt   = null;
    user.verifyAttempts   = 0;
    await user.save();

    const token = makeToken(user._id);
    return {
      token,
      user: { id: user._id, pseudo: user.pseudo || user.name, discriminator: user.discriminator, email: user.email },
    };
  }

  // ── Renvoyer le code de vérification ──────────────────────────────────────
  async resendVerification(email) {
    const user = await User.findOne({ email });

    // Réponse identique si l'email n'existe pas ou est déjà vérifié (évite l'énumération)
    if (!user || user.isVerified || !canSendCode(user)) {
      return { message: "Si cette adresse a un compte en attente, un nouveau code vient d'être envoyé." };
    }

    const verificationCode = generateCode();
    user.verificationCode  = hashCode(user._id, verificationCode);
    user.codeExpires       = new Date(Date.now() + CODE_TTL_VERIFY);
    user.lastCodeSentAt    = new Date();
    user.verifyAttempts    = 0;          // réinitialiser le compteur
    await user.save();

    emailService.sendVerificationEmail(email, verificationCode).catch(err =>
      console.error("[resendVerification] Envoi du code :", err.message)
    );

    return { message: "Si cette adresse a un compte en attente, un nouveau code vient d'être envoyé." };
  }

  // ── Mot de passe oublié ────────────────────────────────────────────────────
  async forgotPassword(email) {
    const user = await User.findOne({ email });
    const genericResponse = {
      message: "Si un compte existe pour cette adresse, un code de réinitialisation vient d'être envoyé.",
    };

    // App publique : même réponse que l'adresse existe ou non, pour ne pas
    // permettre de tester quelles adresses ont un compte Athly.
    if (!user || !canSendCode(user)) return genericResponse;

    const resetPasswordCode = generateCode();
    user.resetPasswordCode  = hashCode(user._id, resetPasswordCode);
    user.codeExpires        = new Date(Date.now() + CODE_TTL_RESET);
    user.lastCodeSentAt     = new Date();
    user.verifyAttempts     = 0;
    await user.save();

    try {
      await emailService.sendResetPasswordEmail(email, resetPasswordCode);
    } catch (err) {
      console.error("[forgotPassword] Échec d'envoi :", {
        code:         err.code,
        command:      err.command,
        response:     err.response,
        responseCode: err.responseCode,
        message:      err.message,
      });
      // On ne remonte pas l'erreur SMTP : l'UX reste propre côté client,
      // le développeur voit la cause exacte dans les logs terminal.
    }

    return genericResponse;
  }

  // ── Réinitialisation du mot de passe ──────────────────────────────────────
  async resetPassword(email, code, newPassword) {
    const user = await User.findOne({ email });
    if (!user || !user.resetPasswordCode) {
      throw httpError("Ce code n'est pas valide. Vérifie-le ou demande-en un nouveau.", 400, "INVALID_CODE");
    }

    // Brute-force
    if (user.verifyAttempts >= MAX_OTP_ATTEMPTS) {
      throw httpError(
        "Trop de codes erronés. Demande un nouveau code pour réessayer.",
        429,
        "TOO_MANY_ATTEMPTS"
      );
    }

    // Expiration
    if (!user.codeExpires || user.codeExpires < new Date()) {
      throw httpError("Ce code a expiré. Demande un nouveau code.", 400, "CODE_EXPIRED");
    }

    // Mauvais code (compteur atomique)
    if (!codeMatches(user._id, code, user.resetPasswordCode)) {
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { verifyAttempts: 1 } },
        { returnDocument: "after" }
      ).select("verifyAttempts");
      const remaining = Math.max(0, MAX_OTP_ATTEMPTS - (updated?.verifyAttempts ?? MAX_OTP_ATTEMPTS));
      throw httpError(
        remaining > 0
          ? `Ce code n'est pas le bon. Il te reste ${remaining} essai${remaining > 1 ? "s" : ""}.`
          : "Trop de codes erronés. Demande un nouveau code pour réessayer.",
        400,
        "INVALID_CODE"
      );
    }

    // Succès : nouveau mot de passe + invalidation de toutes les sessions ouvertes
    user.password          = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.passwordChangedAt = new Date();
    user.resetPasswordCode = undefined;
    user.codeExpires       = undefined;
    user.verifyAttempts    = 0;
    // Recevoir le code par email prouve la possession de l'adresse
    if (!user.isVerified) user.isVerified = true;
    await user.save();

    return { message: "Mot de passe modifié. Tu peux te connecter avec ton nouveau mot de passe." };
  }
}

module.exports = new AuthService();
// Réutilisé par user.service (génération lazy pour les comptes existants)
module.exports.uniqueReferralCode = uniqueReferralCode;
module.exports.uniqueDiscriminator = uniqueDiscriminator;
