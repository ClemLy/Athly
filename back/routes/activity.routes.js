'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const activity = require('../controllers/activity.controller');
const { react } = require('../validators/activity.validator');

router.use(auth);

router.get('/feed',              activity.getFeed);
router.post('/:eventId/react',   validate(react), activity.react);

module.exports = router;
