const userService = require("../services/user.service");

/**
 * RÉCUPÉRER LE PROFIL (MOI)
 * Extrait les données de l'utilisateur actuellement connecté via le token JWT.
 */
exports.getMe = async (req, res, next) => {
  try {
    // req.user.id est injecté par le middleware d'authentification
    const user = await userService.getUserProfile(req.user.id);
    
    // Renvoie une réponse structurée au format JSON
    res.status(200).json({ 
      success: true, 
      user 
    });
  } catch (error) {
    // En cas d'erreur, on passe au middleware de gestion d'erreur global (app.js)
    next(error);
  }
};

/**
 * METTRE À JOUR LE PROFIL
 * Permet à l'utilisateur de modifier ses informations physiques ou ses objectifs.
 */
exports.deleteAccount = async (req, res, next) => {
  try {
    await userService.deleteAccount(req.user.id);
    res.status(200).json({ success: true, message: "Compte supprimé définitivement." });
  } catch (error) {
    next(error);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    // On passe l'ID de l'utilisateur et le corps de la requête au service
    const user = await userService.updateUser(req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: "Profil mis à jour avec succès",
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * METTRE À JOUR LA VITRINE DE TROPHÉES
 * Synchronise la sélection de trophées mis en avant (max 3) pour qu'elle soit
 * visible sur le profil public. Les IDs hors catalogue unifié sont rejetés.
 */
exports.updateShowcase = async (req, res, next) => {
  try {
    const { achievementIds } = req.body;
    const user = await userService.updateShowcase(req.user.id, achievementIds);

    res.status(200).json({
      success: true,
      message: "Vitrine mise à jour avec succès",
      showcasedAchievements: user.showcasedAchievements,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * METTRE À JOUR LES RECORDS MIS EN AVANT
 * Synchronise la sélection de records d'exercices (max 6) affichée sur le
 * profil (le sien ET celui vu par les amis) — voir getFriendProfile.
 * Rejette silencieusement tout exercice jamais pratiqué (ExerciseRecord).
 */
exports.updateRecordsShowcase = async (req, res, next) => {
  try {
    const { exerciseNames } = req.body;
    const user = await userService.updateRecordsShowcase(req.user.id, exerciseNames);

    res.status(200).json({
      success: true,
      message: "Records mis en avant mis à jour",
      showcasedRecords: user.showcasedRecords,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * METTRE À JOUR LE CADRE DE PROFIL ÉQUIPÉ
 * Synchronise le choix de cadre (forme + couleur) fait localement
 * (BorderPicker) pour qu'il soit visible sur le profil public par les amis.
 */
exports.updateFrame = async (req, res, next) => {
  try {
    const { shapeId, colorId } = req.body;
    const user = await userService.updateEquippedFrame(req.user.id, shapeId, colorId);

    res.status(200).json({
      success: true,
      message: "Cadre mis à jour avec succès",
      equippedFrame: user.equippedFrame,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ENREGISTRER LE TOKEN PUSH
 * Permet aux notifications de groupe (Secouer, réactions du flux d'activité…)
 * d'atteindre réellement l'appareil de l'utilisateur.
 */
exports.registerPushToken = async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    await userService.registerPushToken(req.user.id, pushToken);

    res.status(200).json({ success: true, message: "Token push enregistré." });
  } catch (error) {
    next(error);
  }
};

/**
 * MARQUER LE TUTORIEL COMME TERMINÉ
 * Appelé par le front à la fin (ou au skip) du tutoriel interactif.
 * Idempotent — voir user.service.js → completeOnboarding.
 */
exports.completeOnboarding = async (req, res, next) => {
  try {
    const user = await userService.completeOnboarding(req.user.id);

    res.status(200).json({
      success: true,
      message: "Onboarding terminé.",
      hasCompletedOnboarding: user.hasCompletedOnboarding,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * SYNCHRONISER L'XP LOCALE
 * Pousse l'XP totale accumulée localement (front, AsyncStorage-first) vers
 * user.xp/level backend — Source de Vérité pour tout ce qui est gated côté
 * serveur (coffres niveau 11+, conditions de titres). Voir user.service.js
 * → syncXp pour le détail du ratchet anti-régression et du recalcul de niveau.
 */
exports.syncXp = async (req, res, next) => {
  try {
    const { xp } = req.body;
    const result = await userService.syncXp(req.user.id, xp);

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};