const express = require('express');
const router = express.Router();
const admin = require('../controllers/referralAdminController');

// Admin: every student's referral code, its history, and generate / regenerate
router.get('/', admin.list);
router.get('/:studentId', admin.details);
router.post('/:studentId/generate', admin.generate);
router.post('/:studentId/regenerate', admin.regenerate);

module.exports = router;
