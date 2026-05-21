const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

// Admin: Get all registrations (filterable by status)
router.get('/', registrationController.getAllRegistrations);

// Admin: Get only pending registrations
router.get('/pending', registrationController.getPendingRegistrations);

// Admin: Approval flow
router.post('/:id/approve', registrationController.approveRegistration);
router.post('/:id/reject', registrationController.rejectRegistration);

module.exports = router;
