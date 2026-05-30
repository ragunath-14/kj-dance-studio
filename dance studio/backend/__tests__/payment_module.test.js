/**
 * ══════════════════════════════════════════════════════════════════════════════
 * Payment Module — Specialized Unit & Integration Tests
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Run: node __tests__/payment_module.test.js
 * 
 * This suite verifies the core safety features:
 * 1. Duplicate submission prevention (Backend)
 * 2. Inactive student handling
 * 3. Payment amount validation
 */

const axios = require('axios');
const API = 'http://localhost:5001/api';

let passed = 0, failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}${details ? ' — ' + details : ''}`);
    failed++;
  }
}

async function runPaymentTests() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('PAYMENT MODULE PRODUCTION READINESS TESTS');
  console.log('══════════════════════════════════════════════════');

  // Check if server is up
  try {
    await axios.get('http://localhost:5001/health', { timeout: 2000 });
  } catch (e) {
    console.log('❌ Error: Backend server is not running on port 5001.');
    console.log('Please start the server with "npm run dev" before running tests.');
    process.exit(1);
  }

  // 1. DUPLICATE PREVENTION TEST
  console.log('\n§1  DUPLICATE PREVENTION');
  try {
    // 1.1 Create a temporary student for testing
    const studentRes = await axios.post(`${API}/students`, {
      studentName: 'Test Dupe Protection ' + Date.now(),
      phone: '9000000001',
      classType: 'Regular Class',
      studentCategory: 'Adults'
    });
    const studentId = studentRes.data._id;
    const testAmount = 3500;
    const testPurpose = 'Monthly Fee';

    // 1.2 Submit first payment
    const p1 = await axios.post(`${API}/payments`, {
      studentId,
      amount: testAmount,
      purpose: testPurpose,
      method: 'Cash',
      date: new Date()
    });
    assert(p1.status === 201, 'Initial payment recorded successfully');

    // 1.3 Attempt to submit identical payment immediately (Duplicate check)
    try {
      await axios.post(`${API}/payments`, {
        studentId,
        amount: testAmount,
        purpose: testPurpose,
        method: 'Cash',
        date: new Date()
      });
      assert(false, 'Duplicate payment should be REJECTED');
    } catch (err) {
      assert(err.response?.status === 409, 'Backend correctly blocks duplicate payment (409 Conflict)', `Got ${err.response?.status}`);
      assert(err.response?.data?.message?.includes('Duplicate'), 'Error message mentions duplication');
    }

    // 1.4 Attempt with different amount (Should be allowed)
    const p3 = await axios.post(`${API}/payments`, {
      studentId,
      amount: testAmount + 1,
      purpose: testPurpose,
      method: 'Cash',
      date: new Date()
    });
    assert(p3.status === 201, 'Slightly different amount allowed (not a duplicate)');

  } catch (err) {
    assert(false, 'Duplicate protection flow failed', err.response?.data?.message || err.message);
  }

  // 2. INACTIVE STUDENT TEST
  console.log('\n§2  INACTIVE STUDENT LOGIC');
  try {
    // 2.1 Create student and mark as inactive
    const studentRes = await axios.post(`${API}/students`, {
      studentName: 'Test Inactive ' + Date.now(),
      phone: '9000000002',
      classType: 'Fitness Class',
      studentCategory: 'Adults'
    });
    const studentId = studentRes.data._id;

    // Toggle to inactive
    await axios.patch(`${API}/students/${studentId}/toggle-status`);
    
    // 2.2 Verify they appear in Unpaid list with isActive: false
    const unpaidRes = await axios.get(`${API}/students/unpaid`);
    const student = unpaidRes.data.data.find(s => s._id === studentId);
    assert(student !== undefined, 'Inactive student still appears in Unpaid list (Dues persist)');
    assert(student.isActive === false, 'Student correctly marked as isActive: false');

  } catch (err) {
    assert(false, 'Inactive student logic test failed', err.response?.data?.message || err.message);
  }

  // 3. INPUT VALIDATION
  console.log('\n§3  AMOUNT VALIDATION');
  try {
    // 3.1 Zero Amount
    try {
      await axios.post(`${API}/payments`, { studentId: '507f1f77bcf86cd799439011', amount: 0 });
      assert(false, 'Zero amount should be REJECTED');
    } catch (err) {
      assert(err.response?.status === 400, 'Zero amount blocked (400 Bad Request)');
    }

    // 3.2 Negative Amount
    try {
      await axios.post(`${API}/payments`, { studentId: '507f1f77bcf86cd799439011', amount: -500 });
      assert(false, 'Negative amount should be REJECTED');
    } catch (err) {
      assert(err.response?.status === 400, 'Negative amount blocked (400 Bad Request)');
    }
  } catch (err) {
    assert(false, 'Amount validation test failed', err.message);
  }

  console.log('\n══════════════════════════════════════════════════');
  if (failed === 0) {
    console.log('🎉 PAYMENT MODULE IS PRODUCTION READY!');
  } else {
    console.log(`⚠️  TESTS COMPLETED WITH ${failed} FAILURES.`);
  }
  console.log('══════════════════════════════════════════════════\n');
}

runPaymentTests();
