'use strict';

const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/auth.middleware');
const groupStreak = require('../controllers/groupStreak.controller');

// Toutes les routes de groupe exigent un JWT valide
router.use(auth);

// Ordre impératif : les routes littérales AVANT les routes paramétriques
// pour éviter que Express interprète "my-group" comme un :groupId
router.get('/my-group',                       groupStreak.getMyGroup);
router.post('/invite',                        groupStreak.inviteToGroup);
router.put('/respond/:groupId',               groupStreak.respondToGroupInvite);
router.post('/:groupId/shake/:memberId',      groupStreak.shakeMember);
router.post('/:groupId/check-streak',         groupStreak.checkAndUpdateGroupStreaks);

module.exports = router;
