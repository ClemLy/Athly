'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth.middleware');
const reward  = require('../controllers/reward.controller');

router.use(auth);

// ── Profil / Anti-triche anniversaire ─────────────────────────────────────────
router.post('/birthdate',       reward.setBirthdate);

// Jour J : à appeler au login / au chargement de l'app.
router.post('/birthday/check',  reward.checkBirthday);

// ── Trophées / Succès ─────────────────────────────────────────────────────────
router.get('/achievements',  reward.getUserAchievements);

// Vérification manuelle — à appeler aussi depuis les autres contrôleurs
// (openChest, acceptFriendRequest, checkAndUpdateGroupStreaks…)
router.post('/check',        reward.checkAchievements);

// Synchronise les trophées du catalogue LOCAL (V1) débloqués côté client,
// pour qu'ils apparaissent sur le profil public consulté par les amis.
router.put('/achievements/sync', reward.syncLocalAchievements);

module.exports = router;
