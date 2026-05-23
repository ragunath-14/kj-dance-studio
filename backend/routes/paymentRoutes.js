const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// ⚠️ IMPORTANT: Specific named routes MUST come before parameterized /:id routes

// Send WhatsApp pending-fee alerts to ALL overdue students
router.post('/send-pending-alerts', paymentController.sendPendingAlerts);

// Send WhatsApp reminder to a SINGLE specific student (admin manual trigger)
router.post('/send-reminder/:studentId', paymentController.sendStudentReminder);

router.get('/', paymentController.getAllPayments);
router.get('/student/:studentId', paymentController.getStudentPayments);
router.post('/', paymentController.createPayment);
router.put('/:id', paymentController.updatePayment);
router.delete('/:id', paymentController.deletePayment);

module.exports = router;
