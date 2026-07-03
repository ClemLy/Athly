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