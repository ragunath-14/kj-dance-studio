const cron      = require('node-cron');
const Student   = require('./models/Student');
const Payment   = require('./models/Payment');
const whatsapp  = require('./services/whatsappService');

const getMonthlyFee = (classType, studentCategory) => {
  if (classType === 'Fitness Class') return 2000;
  return studentCategory === 'Kids' ? 1000 : 1300;
};

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

    let rejoinSent = 0;

    for (const student of students) {
      // Inactive students — send rejoin invite on their anniversary day
      if (student.isActive === false) {
        const joinDate      = new Date(student.createdAt || student.joinDate);
        const isAnniversary = todayDay === joinDate.getDate();
        if (isAnniversary) {
          const whatsappNum = student.whatsappNumber || student.phone;
          if (whatsappNum) {
            try {
              const result = await whatsapp.sendRejoinMessage(whatsappNum, student.studentName, student.classType);
              if (result.success) {
                console.log(`  📲 Rejoin sent → ${student.studentName}`);
                rejoinSent++;
              }
            } catch (err) {
              console.error(`  ❌ Rejoin failed for ${student.studentName}:`, err.message);
            }
          }
        }
        continue;
      }

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

      const fee           = getMonthlyFee(student.classType, student.studentCategory);
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
      `🔔 [Scheduler] Done — Fee Alerts: ${alertsSent} | Rejoin: ${rejoinSent} | Skipped: ${alertsSkipped} | Failed: ${alertsFailed}\n`
    );
  } catch (err) {
    console.error('❌ [Scheduler] Error during daily checks:', err.message);
  }
}

/**
 * Start the scheduled job using native Node.js timers.
 * Fires daily at 03:30 UTC = 09:00 IST.
 * Uses setInterval instead of node-cron to avoid Intl/timezone crashes on Render.
 */
function startScheduler() {
  const TARGET_UTC_HOUR   = 3;
  const TARGET_UTC_MINUTE = 30;

  const getNextFireMs = () => {
    const now  = new Date();
    const next = new Date();
    next.setUTCHours(TARGET_UTC_HOUR, TARGET_UTC_MINUTE, 0, 0);
    // If target has already passed today, schedule for tomorrow
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next - now;
  };

  const scheduleNext = () => {
    const msUntilNext = getNextFireMs();
    const hoursUntil  = (msUntilNext / 3_600_000).toFixed(1);
    console.log(`⏰ [Scheduler] Next fee alert in ${hoursUntil}h (03:30 UTC = 09:00 IST)`);

    setTimeout(() => {
      runPendingFeeAlerts();
      // After first fire, repeat every 24 hours
      setInterval(runPendingFeeAlerts, 24 * 60 * 60 * 1000);
    }, msUntilNext);
  };

  scheduleNext();
}

module.exports = { startScheduler, runPendingFeeAlerts };
