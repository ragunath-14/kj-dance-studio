const express = require('express');
const router = express.Router();
const campController = require('../controllers/campController');

// Admin: list camp registrations (search / category / status filters + pagination)
router.get('/', campController.getCampRegistrations);

// Admin: confirm a camp seat and send the camp-confirmation WhatsApp message
router.post('/:id/accept', campController.acceptCampRegistration);

// Admin: promote a camp registration to a regular class student
router.post('/:id/convert', campController.convertToStudent);

router.delete('/:id', campController.deleteCampRegistration);

module.exports = router;
