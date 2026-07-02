'use strict';

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth.middleware');
const friend  = require('../controllers/friend.controller');

// Toutes les routes d'amitié exigent un JWT valide
router.use(auth);

// ── Demandes ──────────────────────────────────────────────────────────────────
router.post('/request',            friend.sendFriendRequest);    // Envoyer une demande
router.put('/accept/:requestId',   friend.acceptFriendRequest);  // Accepter
router.put('/decline/:requestId',  friend.declineFriendRequest); // Refuser

// ── Consultation ──────────────────────────────────────────────────────────────
router.get('/list',        friend.getFriendsList);      // Tous mes amis (accepted)
router.get('/pending',     friend.getPendingRequests);  // Demandes reçues en attente
router.get('/search',      friend.searchUsers);         // Recherche par pseudo
router.get('/leaderboard', friend.getLeaderboard);      // Classement XP amis
router.get('/profile/:friendId', friend.getFriendProfile); // Profil public d'un ami

module.exports = router;
