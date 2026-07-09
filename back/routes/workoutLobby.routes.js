'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const lobby    = require('../controllers/workoutLobby.controller');
const { inviteToLobby } = require('../validators/workoutLobby.validator');

router.use(auth);

router.post('/create',        lobby.createLobby);
router.get('/:id',             lobby.getLobby);
router.post('/:id/invite',     validate(inviteToLobby), lobby.inviteToLobby);
router.post('/:id/join',       lobby.joinLobby);
router.post('/:id/ready',      lobby.readyLobby);
router.post('/:id/unready',    lobby.unreadyLobby);
router.post('/:id/finish',     lobby.finishLobby);

module.exports = router;
