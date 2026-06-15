const User        = require("../models/User");
const bcrypt      = require("bcrypt");
const jwt         = require("jsonwebtoken");
const config      = require("../config/env");
const emailService = require("./email.service");

const MAX_OTP_ATTEMPTS  = 5;
const CODE_TTL_VERIFY   = 10 * 60 * 1000; // 10 min
const CODE_TTL_RESET    = 15 * 60 * 1000; // 15 min
const BCRYPT_ROUNDS     = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
  async register(pseudo, email, password) {
    const existing = await User.findOne({ email });
    if (existing) throw httpError("Un utilisateur avec cet email existe déjà.", 409, "EMAIL_TAKEN");

    const hashedPassword   = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationCode = generateCode();

    await User.create({
      pseudo,
      name: pseudo,           // rétrocompatibilité
      email,
      password: hashedPassword,
      isVerified:      false,
      verificationCode,
      codeExpires:     new Date(Date.now() + CODE_TTL_VERIFY),
      verifyAttempts:  0,
    });

    // Envoi non-bloquant : un échec SMTP ne plante pas la réponse
    emailService.sendVerificationEmail(email, verificationCode).catch(err =>
      console.error("❌ Email de vérification :", err.message)
    );

    return { message: "Compte créé. Vérifiez votre email.", email };
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
      user: { id: user._id, pseudo: user.pseudo || user.name, email: user.email },
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
