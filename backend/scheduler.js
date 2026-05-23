const cron      = require('node-cron');
const Student   = require('./models/Student');
const Payment   = require('./models/Payment');
const whatsapp  = require('./services/whatsappService');

const getMonthlyFee = (classType) => classType === 'Fitness Class' ? 2500 : 3500;

/**
 * Core logic: find students with outstanding dues and fire WhatsApp reminders.
 *
 * Rules:
 *  (a) On the student's monthly fee-due date (anniversary day) → always alert if any due.
 *  (b) If the student is overdue by MORE than 1 full month AND at least 4 days have
 *      passed since the last alert → send a follow-up reminder.
 *
 * Called by the daily cron job and also exported for manual/test triggers.
 */
async function runPendingFeeAlerts() {
  const today    = new Date();
  const todayDay = today.getDate(); // 1–31

  console.log(`\n🕘 [Scheduler] Running daily checks (Fees Alerts) — ${today.toDateString()}`);

  try {
    const students = await Student.find().lean();
    const payments = await Payment.find({ purpose: 'Monthly Fee' })
      .select('studentId amount')
      .lean();

    // Pre-calculate payments per student O(M) to avoid O(N×M) slowdown
    // Note: payments are fetched with .lean() so studentId is always a plain ObjectId
    const paymentsByStudent = new Map();
    for (const p of payments) {
      const sid = p.studentId?.toString();
      if (sid) {
        paymentsByStudent.set(sid, (paymentsByStudent.get(sid) || 0) + (p.amount || 0));
      }
    }

    let alertsSent    = 0;
    let alertsSkipped = 0;
    let alertsFailed  = 0;

    for (const student of students) {
      // Skip inactive students
      if (student.isActive === false) continue;

      const joinDate      = new Date(student.createdAt || student.joinDate);
      const joinDay       = joinDate.getDate();
      const isAnniversary = todayDay === joinDay;
      const whatsappNum   = student.whatsappNumber || student.phone;

      // ── Calculate dues ────────────────────────────────────────────────────
      let totalCycles =
        (today.getFullYear() - joinDate.getFullYear()) * 12 +
        (today.getMonth()    - joinDate.getMonth()) + 1;

      if (today.getDate() < joinDay) totalCycles--;
      if (totalCycles <= 0) continue; // Joined this month or future date — no dues yet

      const fee           = getMonthlyFee(student.classType);
      const totalPaid     = paymentsByStudent.get(student._id.toString()) || 0;
      const totalDue      = Math.max(0, (totalCycles * fee) - totalPaid);

      if (totalDue <= 0) {
        // Student is fully paid — clear any stale lastAlertSent flag
        if (student.lastAlertSent) {
          await Student.updateOne({ _id: student._id }, { $unset: { lastAlertSent: '' } });
        }
        alertsSkipped++;
        continue;
      }

      const pendingMonths = Math.ceil(totalDue / fee);

      // ── Decision Logic ─────────────────────────────────────────────────────
      const lastAlert = student.lastAlertSent ? new Date(student.lastAlertSent) : null;
      const diffDays  = lastAlert
        ? Math.floor((today - lastAlert) / (1000 * 60 * 60 * 24))
        : 999; // No prior alert → treat as always eligible

      // Send alert only when:
      //  (a) Today is the student's fee-due anniversary day (any overdue amount), OR
      //  (b) Student is overdue by MORE than 1 month AND at least 4 days since last alert
      const isOverdueMoreThanOneMonth = pendingMonths > 1;
      const isRepeatEligible = isOverdueMoreThanOneMonth && diffDays >= 4;

      if (!isAnniversary && !isRepeatEligible) {
        alertsSkipped++;
        continue;
      }

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
          console.log(`  📲 Alert sent → ${student.studentName} (+${whatsappNum}) — ₹${totalDue} due (${pendingMonths} month(s))`);
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
      `🔔 [Scheduler] Done — Sent: ${alertsSent} | Skipped: ${alertsSkipped} | Failed: ${alertsFailed}\n`
    );
  } catch (err) {
    console.error('❌ [Scheduler] Error during daily checks:', err.message);
  }
}

/**
 * Start the scheduled cron job.
 * Default: every day at 09:00 AM IST.
 * Override via WHATSAPP_SCHEDULE_TIME env var (cron syntax).
 */
function startScheduler() {
  const scheduleTime = process.env.WHATSAPP_SCHEDULE_TIME || '0 9 * * *';
  
  // Sanitize TZ to prevent "RangeError: Invalid time value" if quotes or spaces are present
  let tz = (process.env.TZ || 'Asia/Kolkata').trim();
  if ((tz.startsWith('"') && tz.endsWith('"')) || (tz.startsWith("'") && tz.endsWith("'"))) {
    tz = tz.slice(1, -1).trim();
  }

  try {
    cron.schedule(scheduleTime, () => {
      runPendingFeeAlerts();
    }, {
      scheduled: true,
      timezone: tz
    });
    console.log(`⏰ [Scheduler] Fee alert job scheduled — daily at ${scheduleTime} (TZ: ${tz})`);
  } catch (cronError) {
    console.error(`⚠️ [Scheduler] Failed to schedule with timezone "${tz}". Falling back to local/UTC:`, cronError.message);
    // Fallback: schedule without explicit timezone
    cron.schedule(scheduleTime, () => {
      runPendingFeeAlerts();
    }, {
      scheduled: true
    });
    console.log(`⏰ [Scheduler] Fee alert job scheduled (fallback) — daily at ${scheduleTime} (Local/UTC Time)`);
  }
}

module.exports = { startScheduler, runPendingFeeAlerts };
