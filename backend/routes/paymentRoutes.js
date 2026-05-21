const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// ⚠️ IMPORTANT: Specific named routes MUST come before parameterized /:id routes
// Send WhatsApp pending-fee alerts to all students with outstanding dues
router.post('/send-pending-alerts', paymentController.sendPendingAlerts);

router.get('/', paymentController.getAllPayments);
router.post('/', paymentController.createPayment);
router.put('/:id', paymentController.updatePayment);
router.delete('/:id', paymentController.deletePayment);

module.exports = router;
