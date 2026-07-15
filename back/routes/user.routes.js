const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const auth = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { updateProfile, updateFrame, updateShowcase, updateRecordsShowcase, registerPushToken, syncXp } = require("../validators/user.validator");

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

// Mettre à jour la vitrine de trophées mis en avant (max 3)
router.put("/me/showcase", auth, validate(updateShowcase), userController.updateShowcase);

// Mettre à jour les records d'exercices mis en avant (max 6)
router.put("/me/records-showcase", auth, validate(updateRecordsShowcase), userController.updateRecordsShowcase);

// Enregistrer (ou effacer) le token Expo Push de l'appareil courant
router.put("/me/push-token", auth, validate(registerPushToken), userController.registerPushToken);

// Marquer le tutoriel/onboarding comme terminé — pas de body (idempotent)
router.post("/me/complete-onboarding", auth, userController.completeOnboarding);

// Synchronise l'XP totale locale (front) vers le backend — Source de Vérité
// pour le gating serveur (coffres niveau 11+, conditions de titres).
router.post("/me/sync-xp", auth, validate(syncXp), userController.syncXp);

// Suppression définitive du compte (RGPD)
router.delete("/delete-account", auth, userController.deleteAccount);

module.exports = router;