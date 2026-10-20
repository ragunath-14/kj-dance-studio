const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');

// Public referral endpoints (rate limited in index.js)
router.post('/lookup',     referralController.lookup);
router.post('/suggest',    referralController.suggest);
router.post('/generate',   referralController.generate);
router.post('/regenerate', referralController.regenerate);
router.get('/check/:code', referralController.check);

module.exports = router;
