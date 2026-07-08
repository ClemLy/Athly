const { Types }      = require("mongoose");
const User           = require("../models/User");
const Workout        = require("../models/Workout");
const ExerciseRecord = require("../models/ExerciseRecord");

/**
 * Service gérant la logique liée aux utilisateurs (profil, progression, XP).
 */
class UserService {
  /**
   * Récupère le profil complet d'un utilisateur sans son mot de passe.
   * @param {string} userId - L'ID de l'utilisateur.
   */
  async getUserProfile(userId) {
    // .select("-password") permet d'exclure le champ mot de passe par sécurité
    const user = await User.findById(userId).select("-password");
    if (!user) throw new Error("Utilisateur non trouvé.");

    // Génération lazy pour les comptes antérieurs au parrainage à l'inscription :
    // tout utilisateur qui consulte son profil obtient son code une fois pour toutes.
    if (!user.referralCode) {
      const { uniqueReferralCode } = require("./auth.service");
      user.referralCode = await uniqueReferralCode();
      await user.save();
    }

    // Présence : getMe est appelé à chaque focus d'écran côté front, ce qui
    // en fait un signal "activité récente" fiable pour la Météo des séances
    // (statut 🔥 Prêt) sans avoir besoin d'un endpoint de heartbeat dédié.
    // Fire-and-forget : ne doit jamais retarder ni faire échouer la réponse.
    User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } }).catch(() => {});

    return user;
  }

  /**
   * Met à jour les informations de l'utilisateur.
   * @param {string} userId - L'ID de l'utilisateur.
   * @param {Object} updateData - Les données à modifier (poids, taille, etc.).
   */
  async updateUser(userId, updateData) {
    // { new: true } renvoie le document après modification
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true, // Force la validation des enums dans le schéma
    }).select("-password");
    
    return updatedUser;
  }

  /**
   * Logique de gamification : Ajout d'XP et gestion de montée de niveau.
   * @param {string} userId - L'ID de l'utilisateur.
   * @param {number} xpAmount - Le montant d'XP à ajouter.
   */
  async deleteAccount(userId) {
    const id = new Types.ObjectId(userId);

    const exerciseResult = await ExerciseRecord.deleteMany({ user: id });
    console.log(`🗑️  [deleteAccount] ExerciseRecords supprimés : ${exerciseResult.deletedCount}`);

    const workoutResult = await Workout.deleteMany({ user: id });
    console.log(`🗑️  [deleteAccount] Workouts supprimés      : ${workoutResult.deletedCount}`);

    await User.findByIdAndDelete(id);
    console.log(`🗑️  [deleteAccount] Utilisateur supprimé    : ${userId}`);
  }

  /**
   * Met à jour atomiquement la vitrine de trophées (max 3 IDs).
   * Les IDs sont filtrés sur le catalogue unifié (backend + local) : aucune
   * valeur arbitraire ne peut être stockée puis affichée chez un ami.
   * @param {string} userId
   * @param {string[]} achievementIds
   */
  async updateShowcase(userId, achievementIds) {
    const { ACHIEVEMENT_CATALOG } = require('../controllers/reward.controller');
    const { LOCAL_TROPHY_CATALOG } = require('../data/localTrophyCatalog');

    const validIds = [...new Set(achievementIds)]
      .filter((id) => ACHIEVEMENT_CATALOG[id] || LOCAL_TROPHY_CATALOG[id])
      .slice(0, 3);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { showcasedAchievements: validIds } },
      { new: true, runValidators: true },
    ).select('showcasedAchievements');
    if (!updatedUser) throw new Error('Utilisateur non trouvé.');
    return updatedUser;
  }

  /**
   * Met à jour atomiquement le cadre de profil équipé (forme + couleur).
   * @param {string} userId
   * @param {string} shapeId
   * @param {string} colorId
   */
  async updateEquippedFrame(userId, shapeId, colorId) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { 'equippedFrame.shapeId': shapeId, 'equippedFrame.colorId': colorId } },
      { new: true, runValidators: true },
    ).select('equippedFrame');
    if (!updatedUser) throw new Error('Utilisateur non trouvé.');
    return updatedUser;
  }

  /**
   * Enregistre (ou efface, si null) le token Expo Push de l'appareil courant.
   * @param {string} userId
   * @param {string|null} pushToken
   */
  async registerPushToken(userId, pushToken) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { pushToken } },
      { new: true },
    ).select('pushToken');
    if (!updatedUser) throw new Error('Utilisateur non trouvé.');
    return updatedUser;
  }

  async addExperience(userId, xpAmount) {
    const user = await User.findById(userId);
    user.xp += xpAmount;

    // Logique simple : tous les 1000 XP, on gagne un niveau
    const newLevel = Math.floor(user.xp / 1000) + 1;
    if (newLevel > user.level) {
      user.level = newLevel;
    }

    await user.save();
    return { xp: user.xp, level: user.level };
  }
}

module.exports = new UserService();