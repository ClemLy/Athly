const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const auth = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { updateProfile } = require("../validators/user.validator");

/**
 * ROUTES UTILISATEURS PROTEGEES
 * Toutes ces routes nécessitent un token JWT valide.
 */

// Récupérer mes infos
router.get("/me", auth, userController.getMe);

// Modifier mes infos (avec validation Joi)
router.put("/me", auth, validate(updateProfile), userController.updateMe);

// Suppression définitive du compte (RGPD)
router.delete("/delete-account", auth, userController.deleteAccount);

module.exports = router;