const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

router.get('/dashboard/stats', studentController.getDashboardStats);
router.get('/unpaid', studentController.getUnpaidStudents);
router.get('/', studentController.getAllStudents);
router.post('/', studentController.createStudent);
router.put('/:id', studentController.updateStudent);

router.patch('/:id/toggle-status', studentController.toggleStatus);
router.get('/:id/public-dues', studentController.getStudentDues);
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
