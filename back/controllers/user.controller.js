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