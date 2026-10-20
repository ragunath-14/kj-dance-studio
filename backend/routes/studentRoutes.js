const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

router.get('/unpaid', studentController.getUnpaidStudents);
router.get('/counts', studentController.getStudentCounts);
router.get('/activity', studentController.getActivityLog);
router.get('/', studentController.getAllStudents);
router.post('/', studentController.createStudent);
router.put('/:id', studentController.updateStudent);
router.put('/:id/discount', studentController.setStudentDiscount);
router.get('/:id/offer-timing', studentController.getOfferTiming);

router.patch('/:id/toggle-status', studentController.toggleStatus);
router.get('/:id/public-dues', studentController.getStudentDues);
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
