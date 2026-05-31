const axios = require('axios');
const API_URL = 'http://localhost:5001/api';

async function verifyFlow() {
  console.log('--- STARTING MANUAL VERIFICATION FLOW ---');
  
  try {
    // 1. Create a student with join date 1 month ago
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    console.log('1. Creating student...');
    const studentRes = await axios.post(`${API_URL}/students`, {
      studentName: 'Verification Test User',
      phone: '8888877777',
      classType: 'Regular Class',
      createdAt: oneMonthAgo.toISOString()
    });
    const studentId = studentRes.data._id;
    console.log(`   Success: Created student ID ${studentId}`);

    // 2. Check status in Student List
    console.log('2. Verifying unpaid status...');
    const listRes = await axios.get(`${API_URL}/students`, { params: { search: 'Verification Test User' } });
    const student = listRes.data.data.find(s => s._id === studentId);
    
    // Logic: 1 month ago -> 2 cycles (Month 1, Month 2). 
    // Total Expected = 2 * 3500 = 7000. Total Paid = 0.
    console.log(`   Student totalPaid: ${student.totalPaid}`);
    if (student.totalPaid === 0) {
      console.log('   ✅ PASS: Student correctly showing 0 totalPaid');
    } else {
      console.log('   ❌ FAIL: Student should have 0 totalPaid');
    }

    // 3. Record payment
    console.log('3. Recording payment...');
    await axios.post(`${API_URL}/payments`, {
      studentId: studentId,
      amount: 7000,
      purpose: 'Monthly Fee',
      method: 'Cash'
    });
    console.log('   Success: Recorded ₹7000 payment');

    // 4. Verify updated status
    console.log('4. Verifying paid status...');
    const updatedListRes = await axios.get(`${API_URL}/students`, { params: { search: 'Verification Test User' } });
    const updatedStudent = updatedListRes.data.data.find(s => s._id === studentId);
    console.log(`   Updated totalPaid: ${updatedStudent.totalPaid}`);
    if (updatedStudent.totalPaid === 7000) {
      console.log('   ✅ PASS: Student correctly showing updated totalPaid');
    } else {
      console.log('   ❌ FAIL: totalPaid not updated correctly');
    }

    // 5. Cleanup
    console.log('5. Cleaning up...');
    await axios.delete(`${API_URL}/students/${studentId}`);
    console.log('   Success: Deleted test student');

    console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('❌ FLOW FAILED:', err.response?.data?.message || err.message);
  }
}

verifyFlow();
