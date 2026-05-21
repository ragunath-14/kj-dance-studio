const cron       = require('node-cron');
const Student     = require('./models/Student');
const Payment     = require('./models/Payment');
const whatsapp    = require('./services/whatsappService');

const getMonthlyFee = (classType) => classType === 'Fitness Class' ? 2500 : 3500;

/**
 * Core logic: find students whose fee due date is TODAY and who still
 * have outstanding dues, then fire a WhatsApp reminder for each.
 *
 * "Fee due date" = the same day-of-month as the student's joining date.
 * e.g. if a student joined on the 5th, their fee is due on the 5th of
 * every subsequent month.
 *
 * Called automatically by the cron job, but also exported so it can be
 * triggered manually from a route if needed for testing.
 */
async function runPendingFeeAlerts() {
  const today    = new Date();
  const todayDay = today.getDate(); // 1–31

  console.log(`\n🕘 [Scheduler] Running daily checks (Fees Alerts) — ${today.toDateString()}`);

  try {
    const students = await Student.find().lean(); // Fetch ALL students
    const payments = await Payment.find({ purpose: 'Monthly Fee' })
      .select('studentId amount')
      .lean();

    // Pre-calculate payments per student (O(M)) to prevent O(N*M) slowdowns
    const paymentsByStudent = new Map();
    for (const p of payments) {
      const sid = p.studentId?._id?.toString() || p.studentId?.toString();
      if (sid) {
        paymentsByStudent.set(sid, (paymentsByStudent.get(sid) || 0) + (p.amount || 0));
      }
    }

    let alertsSent    = 0;
    let alertsSkipped = 0;
    let alertsFailed  = 0;

    for (const student of students) {
      const joinDate    = new Date(student.createdAt || student.joinDate);
      const joinDay     = joinDate.getDate(); // The day-of-month fees are due/anniversary
      const isAnniversary = todayDay === joinDay;
      const whatsappNum   = student.whatsappNumber || student.phone;

      // Skip fee logic for inactive students
      if (student.isActive === false) {
        continue;
      }

      // ── Active Student Logic: Calculate how many months of fees are owed ──
      let totalCycles =
        (today.getFullYear() - joinDate.getFullYear()) * 12 +
        (today.getMonth()    - joinDate.getMonth()) + 1;

      // Anniversary day check
      if (today.getDate() < joinDay) {
        totalCycles--;
      }
      
      if (totalCycles <= 0) continue;

      const totalPaid = paymentsByStudent.get(student._id.toString()) || 0;

      const fee = getMonthlyFee(student.classType);
      const totalExpected = totalCycles * fee;
      const totalDue      = Math.max(0, totalExpected - totalPaid);

      if (totalDue <= 0) {
        // Clear lastAlertSent if they are fully paid
        if (student.lastAlertSent) {
          await Student.updateOne({ _id: student._id }, { $unset: { lastAlertSent: "" } });
        }
        alertsSkipped++;
        continue;
      }

      // ── Decision Logic: When to send an alert? ───────────────────────────
      const lastAlert = student.lastAlertSent ? new Date(student.lastAlertSent) : null;
      const diffDays = lastAlert ? Math.floor((today - lastAlert) / (1000 * 60 * 60 * 24)) : 999;
      
      // Send if it's the anniversary...
      // ...OR if they are already overdue and it's been at least 3 days since the last alert
      if (!isAnniversary && diffDays < 3) {
        continue;
      }

      const pendingMonths = Math.ceil(totalDue / fee);

      if (!whatsappNum) {
        alertsSkipped++;
        continue;
      }

      try {
        const result = await whatsapp.sendPendingFeesAlert(
          student._id,
          whatsappNum,
          student.studentName,
          pendingMonths,
          totalDue
        );

        if (result.success) {
          console.log(`  📲 Alert sent → ${student.studentName} (+${whatsappNum}) — ₹${totalDue} due`);
          // Record the timestamp
          await Student.updateOne({ _id: student._id }, { lastAlertSent: today });
          alertsSent++;
        } else {
          console.log(`  ⚠️  Alert not sent → ${student.studentName} — ${result.reason}`);
          alertsSkipped++;
        }
      } catch (err) {
        console.error(`  ❌ Failed for ${student.studentName}:`, err.message);
        alertsFailed++;
      }
    }

    console.log(
      `🔔 [Scheduler] Done — Fee Alerts Sent: ${alertsSent} | Skipped: ${alertsSkipped} | Failed: ${alertsFailed}\n`
    );
  } catch (err) {
    console.error('❌ [Scheduler] Error during daily checks:', err.message);
  }
}

/**
 * Start the scheduled job.
 * Runs every day at 09:00 AM server time.
 * Cron syntax: second(opt) minute hour day month weekday
 */
function startScheduler() {
  // Run every day at configured time (default 09:00 AM IST)
  const scheduleTime = process.env.WHATSAPP_SCHEDULE_TIME || '0 9 * * *';
  cron.schedule(scheduleTime, () => {
    runPendingFeeAlerts();
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'Asia/Kolkata'  // IST by default
  });

  console.log(`⏰ [Scheduler] Pending-fee alert job scheduled — runs daily at ${scheduleTime} (Timezone: ${process.env.TZ || 'Asia/Kolkata'})`);
}

module.exports = { startScheduler, runPendingFeeAlerts };
