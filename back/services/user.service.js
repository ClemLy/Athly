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