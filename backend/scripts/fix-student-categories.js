/**
 * fix-student-categories.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration script: scans every student in the DB and corrects their
 * studentCategory based on their age + classType.
 *
 * Rules:
 *   Fitness Class                 → always 'Adults'
 *   Regular/Dance/Online + age ≤9 → 'Kids'
 *   Regular/Dance/Online + age >9 → 'Adults'
 *   Missing/invalid age           → 'Adults'
 *
 * Run once with:
 *   node backend/scripts/fix-student-categories.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Student  = require('../models/Student');

const computeCategory = (age, classType) => {
  if (classType === 'Fitness Class') return 'Adults';
  const n = parseInt(age);
  if (!age || isNaN(n)) return 'Adults';
  return n <= 9 ? 'Kids' : 'Adults';
};

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGO_URI not found in environment. Cannot connect.');
    process.exit(1);
  }

  console.log('🔗  Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('✅  Connected.\n');

  const students = await Student.find({}).lean();
  console.log(`📋  Found ${students.length} total students.\n`);

  let fixed = 0, skipped = 0, alreadyCorrect = 0;

  for (const student of students) {
    const expected = computeCategory(student.studentAge, student.classType);
    const current  = student.studentCategory;

    if (current === expected) {
      alreadyCorrect++;
      continue;
    }

    await Student.findByIdAndUpdate(student._id, { studentCategory: expected });
    console.log(
      `  ✏️  "${student.studentName}"  age=${student.studentAge || '—'}  class=${student.classType || '—'}` +
      `  |  "${current || 'missing'}" → "${expected}"`
    );
    fixed++;
  }

  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`✅  Already correct : ${alreadyCorrect}`);
  console.log(`✏️   Fixed           : ${fixed}`);
  console.log(`⏭️   Skipped         : ${skipped}`);
  console.log('─────────────────────────────────────────────────────────\n');

  await mongoose.disconnect();
  console.log('🔌  Disconnected. Done!');
}

run().catch(err => {
  console.error('💥  Migration failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
