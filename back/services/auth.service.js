const crypto      = require("crypto");
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
const BCRYPT_ROUNDS     = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
  return String(Math.floor(1000 + Math.random() * 9000));
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
    if (existing) throw httpError("Un utilisateur avec cet email existe déjà.", 409, "EMAIL_TAKEN");

    // ── Résolution du parrain AVANT création : un code invalide ne doit pas
    //    laisser un compte à moitié parrainé en base ────────────────────────
    let referrer = null;
    const cleanCode = typeof referralCode === "string" ? referralCode.trim().toUpperCase() : "";
    if (cleanCode) {
      referrer = await User.findOne({ referralCode: cleanCode }).select("_id");
      if (!referrer) {
        throw httpError("Code de parrainage invalide.", 400, "REFERRAL_INVALID");
      }
    }

    const hashedPassword   = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationCode = generateCode();

    const newUser = await User.create({
      pseudo,
      name: pseudo,           // rétrocompatibilité
      email,
      password: hashedPassword,
      isVerified:      false,
      verificationCode,
      codeExpires:     new Date(Date.now() + CODE_TTL_VERIFY),
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
        console.error("⚠️  [register] Récompenses de parrainage partielles :", err.message);
      }
    }

    // Envoi non-bloquant : un échec SMTP ne plante pas la réponse
    emailService.sendVerificationEmail(email, verificationCode).catch(err =>
      console.error("❌ Email de vérification :", err.message)
    );

    return {
      message:  "Compte créé. Vérifiez votre email.",
      email,
      referred: Boolean(referrer),
    };
  }

  // ── Connexion ──────────────────────────────────────────────────────────────
  async login(email, password) {
    const user = await User.findOne({ email });
    if (!user) throw httpError("Identifiants incorrects.", 401, "INVALID_CREDENTIALS");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw httpError("Identifiants incorrects.", 401, "INVALID_CREDENTIALS");

    if (!user.isVerified) {
      const verificationCode = generateCode();
      user.verificationCode  = verificationCode;
      user.codeExpires       = new Date(Date.now() + CODE_TTL_VERIFY);
      user.verifyAttempts    = 0;
      await user.save();

      emailService.sendVerificationEmail(user.email, verificationCode).catch(err =>
        console.error("❌ Renvoi code (login) :", err.message)
      );

      throw httpError(
        "Email non vérifié. Un nouveau code de validation a été envoyé.",
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
    if (!config.googleClientId) {
      throw httpError("Connexion Google non configurée sur ce serveur.", 501, "GOOGLE_OAUTH_NOT_CONFIGURED");
    }
    if (!idToken) {
      throw httpError("idToken manquant.", 400, "GOOGLE_TOKEN_MISSING");
    }

    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(config.googleClientId);

    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
      payload = ticket.getPayload();
    } catch (_err) {
      throw httpError("Token Google invalide.", 401, "GOOGLE_TOKEN_INVALID");
    }

    if (!payload?.sub || !payload?.email) {
      throw httpError("Token Google invalide.", 401, "GOOGLE_TOKEN_INVALID");
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
    if (!user) throw httpError("Utilisateur introuvable.", 404, "USER_NOT_FOUND");

    if (user.isVerified) throw httpError("Ce compte est déjà vérifié.", 400, "ALREADY_VERIFIED");

    // Brute-force : max MAX_OTP_ATTEMPTS tentatives
    if (user.verifyAttempts >= MAX_OTP_ATTEMPTS) {
      throw httpError(
        `Trop de tentatives (max ${MAX_OTP_ATTEMPTS}). Demandez un nouveau code.`,
        429,
        "TOO_MANY_ATTEMPTS"
      );
    }

    // Expiration
    if (!user.codeExpires || user.codeExpires < new Date()) {
      throw httpError("Code expiré. Demandez un nouveau code.", 400, "CODE_EXPIRED");
    }

    // Mauvais code → incrémenter le compteur
    if (user.verificationCode !== code) {
      user.verifyAttempts += 1;
      await user.save();
      const remaining = MAX_OTP_ATTEMPTS - user.verifyAttempts;
      throw httpError(
        `Code invalide. ${remaining} tentative(s) restante(s).`,
        400,
        "INVALID_CODE"
      );
    }

    // ✅ Succès : activer le compte et nettoyer les champs OTP
    user.isVerified       = true;
    user.verificationCode = undefined;
    user.codeExpires      = undefined;
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

    // Réponse identique si l'email n'existe pas (évite l'énumération)
    if (!user || user.isVerified) {
      if (user?.isVerified) throw httpError("Ce compte est déjà vérifié.", 400, "ALREADY_VERIFIED");
      return { message: "Si cet email est enregistré, un nouveau code a été envoyé." };
    }

    const verificationCode = generateCode();
    user.verificationCode  = verificationCode;
    user.codeExpires       = new Date(Date.now() + CODE_TTL_VERIFY);
    user.verifyAttempts    = 0;          // réinitialiser le compteur
    await user.save();

    emailService.sendVerificationEmail(email, verificationCode).catch(err =>
      console.error("❌ Renvoi email :", err.message)
    );

    return { message: "Si cet email est enregistré, un nouveau code a été envoyé." };
  }

  // ── Mot de passe oublié ────────────────────────────────────────────────────
  async forgotPassword(email) {
    const user = await User.findOne({ email });

    // 404 explicite : le frontend affiche un message clair à l'utilisateur.
    // Trade-off assumé : on révèle si l'email existe (meilleure UX, app non publique).
    if (!user) {
      throw httpError(
        "Aucun compte n'est associé à cette adresse e-mail.",
        404,
        "EMAIL_NOT_FOUND"
      );
    }

    const resetPasswordCode = generateCode();
    user.resetPasswordCode  = resetPasswordCode;
    user.codeExpires        = new Date(Date.now() + CODE_TTL_RESET);
    user.verifyAttempts     = 0;
    await user.save();

    try {
      await emailService.sendResetPasswordEmail(email, resetPasswordCode);
    } catch (err) {
      console.error(`❌ [forgotPassword] Échec d'envoi à ${email} :`, {
        code:         err.code,
        command:      err.command,
        response:     err.response,
        responseCode: err.responseCode,
        message:      err.message,
      });
      // On ne remonte pas l'erreur SMTP : l'UX reste propre côté client,
      // le développeur voit la cause exacte dans les logs terminal.
    }

    return { message: "Code de réinitialisation envoyé." };
  }

  // ── Réinitialisation du mot de passe ──────────────────────────────────────
  async resetPassword(email, code, newPassword) {
    const user = await User.findOne({ email });
    if (!user) throw httpError("Utilisateur introuvable.", 404, "USER_NOT_FOUND");

    // Brute-force
    if (user.verifyAttempts >= MAX_OTP_ATTEMPTS) {
      throw httpError(
        `Trop de tentatives (max ${MAX_OTP_ATTEMPTS}). Demandez un nouveau code.`,
        429,
        "TOO_MANY_ATTEMPTS"
      );
    }

    // Expiration
    if (!user.codeExpires || user.codeExpires < new Date()) {
      throw httpError("Code expiré. Demandez un nouveau code.", 400, "CODE_EXPIRED");
    }

    // Mauvais code
    if (user.resetPasswordCode !== code) {
      user.verifyAttempts += 1;
      await user.save();
      const remaining = MAX_OTP_ATTEMPTS - user.verifyAttempts;
      throw httpError(
        `Code invalide. ${remaining} tentative(s) restante(s).`,
        400,
        "INVALID_CODE"
      );
    }

    // ✅ Succès : hacher et sauvegarder le nouveau mot de passe
    user.password          = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.resetPasswordCode = undefined;
    user.codeExpires       = undefined;
    user.verifyAttempts    = 0;
    await user.save();

    return { message: "Mot de passe réinitialisé avec succès." };
  }
}

module.exports = new AuthService();
// Réutilisé par user.service (génération lazy pour les comptes existants)
module.exports.uniqueReferralCode = uniqueReferralCode;
module.exports.uniqueDiscriminator = uniqueDiscriminator;
