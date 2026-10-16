'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const cloud    = require('../controllers/cloud.controller');
const { sync } = require('../validators/cloud.validator');

router.use(auth);

router.get('/:kind',       cloud.list);
router.post('/:kind/sync', validate(sync), cloud.sync);

module.exports = router;
