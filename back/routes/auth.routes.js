const express    = require("express");
const router     = express.Router();
const ctrl       = require("../controllers/auth.controller");
const validate   = require("../middleware/validate.middleware");
const schemas    = require("../validators/auth.validator");

// ── Routes publiques ──────────────────────────────────────────────────────────

// POST /api/auth/register
router.post("/register",
  validate(schemas.register),
  ctrl.registerUser
);

// POST /api/auth/login
router.post("/login",
  validate(schemas.login),
  ctrl.loginUser
);

// POST /api/auth/verify-email
router.post("/verify-email",
  validate(schemas.verifyEmail),
  ctrl.verifyEmailUser
);

// POST /api/auth/resend-verification
router.post("/resend-verification",
  validate(schemas.resendVerification),
  ctrl.resendVerificationUser
);

// POST /api/auth/forgot-password
router.post("/forgot-password",
  validate(schemas.forgotPassword),
  ctrl.forgotPasswordUser
);

// POST /api/auth/reset-password
router.post("/reset-password",
  validate(schemas.resetPassword),
  ctrl.resetPasswordUser
);

module.exports = router;
