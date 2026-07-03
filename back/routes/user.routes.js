const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const auth = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { updateProfile, updateFrame, updateShowcase } = require("../validators/user.validator");

/**
 * ROUTES UTILISATEURS PROTEGEES
 * Toutes ces routes nécessitent un token JWT valide.
 */

// Récupérer mes infos
router.get("/me", auth, userController.getMe);

// Modifier mes infos (avec validation Joi)
router.put("/me", auth, validate(updateProfile), userController.updateMe);

// Synchroniser le cadre de profil équipé (visible sur le profil public)
router.put("/me/frame", auth, validate(updateFrame), userController.updateFrame);

// Synchroniser la vitrine de trophées (max 3, visible sur le profil public)
router.put("/me/showcase", auth, validate(updateShowcase), userController.updateShowcase);

// Suppression définitive du compte (RGPD)
router.delete("/delete-account", auth, userController.deleteAccount);

module.exports = router;