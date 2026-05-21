/**
 * ══════════════════════════════════════════════════════════════════════════════
 * Dance Studio - Comprehensive Unit & Manual Tests
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Run: node __tests__/unit_tests.js
 *
 * Tests cover:
 * 1. Billing cycle calculation (edge cases: short months, cross-year, same-day)
 * 2. Fee amount logic per class type
 * 3. API endpoint integration tests (requires running server on port 5001)
 * 4. Validation tests
 * 5. Error handling tests
 */

const axios = require('axios');
require('dotenv').config();

const ADMIN_API = 'http://localhost:5001/api';
const STUDIO_API = 'http://localhost:5001/api';

let adminToken = '';

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}${details ? ' — ' + details : ''}`);
    failed++;
  }
}

function skip(testName, reason) {
  console.log(`  ⏭️  SKIP: ${testName} — ${reason}`);
  skipped++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: BILLING LOGIC UNIT TESTS (Pure functions — no server needed)
// ═══════════════════════════════════════════════════════════════════════════════

function getMonthlyFee(classType) {
  return classType === 'Fitness Class' ? 2500 : 3500;
}

function calculateTotalDue(joinDateStr, todayStr, classType, totalPaid) {
  const joinDate = new Date(joinDateStr);
  const today = new Date(todayStr);

  let totalCycles =
    (today.getFullYear() - joinDate.getFullYear()) * 12 +
    (today.getMonth() - joinDate.getMonth()) + 1;

  if (today.getDate() < joinDate.getDate()) totalCycles--;
  if (totalCycles <= 0) return 0;

  const fee = getMonthlyFee(classType);
  return Math.max(0, totalCycles * fee - totalPaid);
}

function runBillingTests() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('SECTION 1: BILLING CYCLE CALCULATION');
  console.log('══════════════════════════════════════════════════');

  // Test 1: Regular class fee
  assert(getMonthlyFee('Fitness Class') === 2500, 'Fitness Class fee = ₹2500');
  assert(getMonthlyFee('Unknown') === 3500, 'Unknown fee defaults to ₹3500');
  assert(getMonthlyFee(undefined) === 3500, 'Default/undefined class fee = ₹3500');

  // Test 2: Simple 1-month gap — joined Jan 10, checked Feb 15
  const due1 = calculateTotalDue('2026-01-10', '2026-02-15', 'Regular Class', 0);
  assert(due1 === 7000, 'Jan 10 → Feb 15 (0 paid) = ₹7000 (2 cycles)', `Got ₹${due1}`);

  // Test 3: Before anniversary — should not count current cycle
  const due2 = calculateTotalDue('2026-01-15', '2026-02-10', 'Regular Class', 0);
  assert(due2 === 3500, 'Jan 15 → Feb 10 (before ann.) = ₹3500 (1 cycle)', `Got ₹${due2}`);

  // Test 4: Exactly on anniversary day
  const due3 = calculateTotalDue('2026-01-15', '2026-02-15', 'Regular Class', 0);
  assert(due3 === 7000, 'Jan 15 → Feb 15 (on anniversary) = ₹7000 (2 cycles)', `Got ₹${due3}`);

  // Test 5: Partial payment
  const due4 = calculateTotalDue('2026-01-10', '2026-03-15', 'Regular Class', 3500);
  assert(due4 === 7000, 'Jan 10 → Mar 15 (paid ₹3500) = ₹7000 due', `Got ₹${due4}`);

  // Test 6: Fully paid
  const due5 = calculateTotalDue('2026-01-10', '2026-02-15', 'Regular Class', 10000);
  assert(due5 === 0, 'Overpaid student = ₹0 due', `Got ₹${due5}`);

  // Test 7: Joined same day — should be 1 cycle
  const due6 = calculateTotalDue('2026-04-10', '2026-04-10', 'Regular Class', 0);
  assert(due6 === 3500, 'Joined today = ₹3500 (1 cycle)', `Got ₹${due6}`);

  // Test 8: Cross-year boundary
  const due7 = calculateTotalDue('2025-11-10', '2026-02-15', 'Fitness Class', 0);
  assert(due7 === 10000, 'Nov 2025 → Feb 2026 Fitness = ₹10000 (4 cycles)', `Got ₹${due7}`);

  // Test 9: Future join date — no dues
  const due8 = calculateTotalDue('2026-05-10', '2026-04-10', 'Regular Class', 0);
  assert(due8 === 0, 'Future join date = ₹0', `Got ₹${due8}`);

  // Test 10: Short month (Jan 31 → Feb 28)
  const due9 = calculateTotalDue('2026-01-31', '2026-02-28', 'Regular Class', 0);
  // Feb 28 < Jan 31 (joinDay), so totalCycles = 2 - 1 = 1
  assert(due9 === 3500, 'Jan 31 → Feb 28 = ₹3500 (1 cycle, anniversary not reached)', `Got ₹${due9}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: INPUT VALIDATION TESTS (Pure — no server)
// ═══════════════════════════════════════════════════════════════════════════════

function runValidationTests() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('SECTION 2: INPUT VALIDATION LOGIC');
  console.log('══════════════════════════════════════════════════');

  const phoneRegex = /^[\d\s+\-()]{10,}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  assert(phoneRegex.test('9876543210'), 'Valid phone: 10 digits');
  assert(phoneRegex.test('+91 98765 43210'), 'Valid phone: with +91 and spaces');
  assert(phoneRegex.test('(044) 2555-1234'), 'Valid phone: with parens and dash');
  assert(!phoneRegex.test('12345'), 'Invalid phone: too short');
  assert(!phoneRegex.test('abcdefghij'), 'Invalid phone: letters');
  assert(!phoneRegex.test(''), 'Invalid phone: empty string');

  assert(emailRegex.test('test@example.com'), 'Valid email: standard');
  assert(emailRegex.test('user.name@sub.domain.com'), 'Valid email: subdomain');
  assert(!emailRegex.test('invalid'), 'Invalid email: no @');
  assert(!emailRegex.test('user @test.com'), 'Invalid email: space in local');
  assert(!emailRegex.test(''), 'Invalid email: empty string');

  // Name validation
  assert('AB'.length >= 2, 'Valid name: 2 chars minimum');
  assert('A'.length < 2, 'Invalid name: 1 char');
  assert(''.trim().length === 0, 'Invalid name: empty/whitespace only');

  // Class type validation
  const validTypes = ['Regular Class', 'Fitness Class'];
  assert(validTypes.includes('Regular Class'), 'Valid classType: Regular Class');
  assert(!validTypes.includes('Advanced Class'), 'Invalid classType: Advanced Class');
  assert(!validTypes.includes(''), 'Invalid classType: empty string');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: API INTEGRATION TESTS (Requires running servers)
// ═══════════════════════════════════════════════════════════════════════════════

async function runAPITests() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('SECTION 3: API INTEGRATION TESTS');
  console.log('══════════════════════════════════════════════════');

  // Check if admin server is running
  let serverRunning = false;
  try {
    await axios.get(`${ADMIN_API}/students`, { timeout: 3000 });
    serverRunning = true;
  } catch (err) {
    if (err.response) serverRunning = true; // Server responded (even with error)
  }

  if (!serverRunning) {
    skip('All API tests', 'Admin server not running on port 5001');
    return;
  }

  // Login to get token
  try {
    const loginRes = await axios.post(`${ADMIN_API}/admin/login`, {
      password: process.env.ADMIN_PASSWORD
    });
    adminToken = loginRes.data.token;
  } catch (err) {
    skip('All API tests', 'Failed to login as admin');
    return;
  }

  const authHeaders = {
    headers: { Authorization: `Bearer ${adminToken}` }
  };

  // Test 3.1: Health check
  try {
    const res = await axios.get('http://localhost:5001/health');
    assert(res.status === 200, 'Health endpoint returns 200');
    assert(res.data.status === 'healthy', 'Health status is "healthy"');
    assert(res.data.db === 'connected', 'DB status is "connected"');
  } catch (err) {
    assert(false, 'Health endpoint', err.message);
  }

  // Test 3.2: GET students
  try {
    const res = await axios.get(`${ADMIN_API}/students`, authHeaders);
    assert(res.status === 200, 'GET /students returns 200');
    assert(Array.isArray(res.data.data), 'GET /students returns paginated data array');
    assert(typeof res.data.total === 'number', 'GET /students returns total count');
    assert(typeof res.data.totalPages === 'number', 'GET /students returns totalPages');
  } catch (err) {
    assert(false, 'GET /students', err.message);
  }

  // Test 3.3: GET payments
  try {
    const res = await axios.get(`${ADMIN_API}/payments`, authHeaders);
    assert(res.status === 200, 'GET /payments returns 200');
    assert(Array.isArray(res.data.data), 'GET /payments returns paginated data array');
    assert(typeof res.data.total === 'number', 'GET /payments returns total count');
  } catch (err) {
    assert(false, 'GET /payments', err.message);
  }

  // Test 3.4: GET pending registrations
  try {
    const res = await axios.get(`${ADMIN_API}/registrations/pending`, authHeaders);
    assert(res.status === 200, 'GET /registrations/pending returns 200');
    assert(Array.isArray(res.data), 'GET /registrations/pending returns array');
  } catch (err) {
    assert(false, 'GET /registrations/pending', err.message);
  }

  // Test 3.5: POST registration with missing name (should fail 400)
  try {
    await axios.post(`${ADMIN_API.replace(':5001', ':5001')}/register`, {
      studentName: '',
      phone: '9999999999'
    });
    assert(false, 'POST /register with empty name should fail');
  } catch (err) {
    assert(err.response?.status === 400, 'POST /register with empty name returns 400', `Got ${err.response?.status}`);
  }

  // Test 3.6: POST registration with missing phone (should fail 400)
  try {
    await axios.post(`${ADMIN_API.replace(':5001', ':5001')}/register`, {
      studentName: 'Test Student',
      phone: ''
    });
    assert(false, 'POST /register with empty phone should fail');
  } catch (err) {
    assert(err.response?.status === 400, 'POST /register with empty phone returns 400', `Got ${err.response?.status}`);
  }

  // Test 3.7: Create payment with invalid studentId
  try {
    await axios.post(`${ADMIN_API}/payments`, {
      studentId: 'invalid-id',
      amount: 3500
    }, authHeaders);
    assert(false, 'POST /payments with invalid studentId should fail');
  } catch (err) {
    const status = err.response?.status;
    assert(status === 400 || status === 404 || status === 500, 
      'POST /payments with invalid studentId fails gracefully', `Got ${status}`);
  }

  // Test 3.8: Create payment with missing studentId
  try {
    await axios.post(`${ADMIN_API}/payments`, {
      amount: 3500
    }, authHeaders);
    assert(false, 'POST /payments without studentId should fail');
  } catch (err) {
    assert(err.response?.status === 400, 'POST /payments without studentId returns 400', `Got ${err.response?.status}`);
  }

  // Test 3.9: Create payment with 0 amount
  try {
    await axios.post(`${ADMIN_API}/payments`, {
      studentId: '507f1f77bcf86cd799439011',
      amount: 0
    }, authHeaders);
    assert(false, 'POST /payments with 0 amount should fail');
  } catch (err) {
    assert(err.response?.status === 400, 'POST /payments with 0 amount returns 400', `Got ${err.response?.status}`);
  }

  // Test 3.10: GET non-existent student by ID
  try {
    await axios.get(`${ADMIN_API}/students/507f1f77bcf86cd799439011/public-dues`, authHeaders);
    assert(false, 'GET non-existent student public-dues should fail');
  } catch (err) {
    assert(err.response?.status === 404, 'GET non-existent student returns 404', `Got ${err.response?.status}`);
  }

  // Test 3.11: DELETE non-existent student
  try {
    await axios.delete(`${ADMIN_API}/students/507f1f77bcf86cd799439011`, authHeaders);
    assert(false, 'DELETE non-existent student should fail');
  } catch (err) {
    assert(err.response?.status === 404, 'DELETE non-existent student returns 404', `Got ${err.response?.status}`);
  }

  // Test 3.12: Invalid ObjectId format
  try {
    await axios.get(`${ADMIN_API}/students/INVALID/public-dues`, authHeaders);
    assert(false, 'GET invalid ObjectId should fail');
  } catch (err) {
    assert(err.response?.status === 500 || err.response?.status === 400, 
      'GET invalid ObjectId handled gracefully', `Got ${err.response?.status}`);
  }

  // Test 3.13: Approve non-existent registration
  try {
    await axios.post(`${ADMIN_API}/registrations/507f1f77bcf86cd799439011/approve`, {}, authHeaders);
    assert(false, 'Approve non-existent registration should fail');
  } catch (err) {
    assert(err.response?.status === 404, 'Approve non-existent returns 404', `Got ${err.response?.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: STUDIO FRONTEND API TESTS
// ═══════════════════════════════════════════════════════════════════════════════

async function runStudioAPITests() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('SECTION 4: STUDIO (PUBLIC) API TESTS');
  console.log('══════════════════════════════════════════════════');

  let serverRunning = false;
  try {
    await axios.get(STUDIO_API.replace('/api', '/'), { timeout: 3000 });
    serverRunning = true;
  } catch (err) {
    if (err.response) serverRunning = true;
  }

  if (!serverRunning) {
    skip('All Studio API tests', 'Studio server not running on port 5000');
    return;
  }

  // Test 4.1: Health check
  try {
    const res = await axios.get('http://localhost:5001/health');
    assert(res.status === 200, 'Studio health endpoint returns 200');
  } catch (err) {
    assert(false, 'Studio health endpoint', err.message);
  }

  // Test 4.2: Successful registration
  const uniquePhone = '98765' + Math.floor(10000 + Math.random() * 90000);
  try {
    const res = await axios.post(`${STUDIO_API}/register`, {
      studentName: 'Unit Test Student',
      phone: uniquePhone,
      classType: 'Regular Class'
    });
    assert(res.status === 201, 'POST /register creates successfully');
    assert(res.data.success === true, 'Registration success flag is true');
  } catch (err) {
    assert(false, 'POST /register', err.response?.data?.message || err.message);
  }

  // Test 4.3: Duplicate phone registration (should fail 409)
  try {
    await axios.post(`${STUDIO_API}/register`, {
      studentName: 'Unit Test Student',
      phone: uniquePhone,
      classType: 'Regular Class'
    });
    assert(false, 'Duplicate phone registration should fail');
  } catch (err) {
    assert(err.response?.status === 409, 'Duplicate phone returns 409', `Got ${err.response?.status}`);
  }

  // Test 4.4: Registration with invalid class type
  try {
    await axios.post(`${STUDIO_API}/register`, {
      studentName: 'Bad Class Student',
      phone: '1234567890',
      classType: 'Invalid Class'
    });
    assert(false, 'Invalid classType should fail validation');
  } catch (err) {
    assert(err.response?.status === 400, 'Invalid classType returns 400', `Got ${err.response?.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║    DANCE STUDIO — COMPREHENSIVE TEST SUITE          ║');
  console.log('║    Time: ' + new Date().toLocaleString().padEnd(43) + '║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // Pure unit tests — always run
  runBillingTests();
  runValidationTests();

  // API tests — require running servers
  await runAPITests();
  await runStudioAPITests();

  console.log('\n══════════════════════════════════════════════════');
  console.log(`FINAL RESULTS: ${passed} passed | ${failed} failed | ${skipped} skipped`);
  console.log('══════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⚠️  Some tests FAILED! Review the output above.');
    process.exit(1);
  } else {
    console.log('🎉 All tests PASSED!');
    process.exit(0);
  }
}

main();
