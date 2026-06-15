const authService = require("../services/auth.service");

// ── Inscription ───────────────────────────────────────────────────────────────
exports.registerUser = async (req, res, next) => {
  try {
    const { pseudo, email, password } = req.body;
    const result = await authService.register(pseudo, email, password);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// ── Connexion ─────────────────────────────────────────────────────────────────
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const data = await authService.login(email, password);
    res.status(200).json({ success: true, message: "Connexion réussie.", ...data });
  } catch (error) {
    // Propager le code d'erreur au front pour rediriger vers EmailVerification si besoin
    if (error.code === "EMAIL_NOT_VERIFIED") {
      return res.status(403).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
    next(error);
  }
};

// ── Vérification email ────────────────────────────────────────────────────────
exports.verifyEmailUser = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const result = await authService.verifyEmail(email, code);
    res.status(200).json({ success: true, message: "Email vérifié.", ...result });
  } catch (error) {
    if (error.code) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
    next(error);
  }
};

// ── Renvoyer le code de vérification ─────────────────────────────────────────
exports.resendVerificationUser = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.resendVerification(email);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// ── Mot de passe oublié ───────────────────────────────────────────────────────
exports.forgotPasswordUser = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    // Erreurs métier (EMAIL_NOT_FOUND, etc.) : renvoie le code pour que le
    // frontend puisse afficher un message précis sans interpréter le statusCode.
    if (error.code) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        code:    error.code,
      });
    }
    next(error);
  }
};

// ── Réinitialisation du mot de passe ─────────────────────────────────────────
exports.resetPasswordUser = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    const result = await authService.resetPassword(email, code, newPassword);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error.code) {
      return res.status(error.statusCode || 400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
    next(error);
  }
};
