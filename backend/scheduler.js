const Student   = require('./models/Student');
const Payment   = require('./models/Payment');
const whatsapp  = require('./services/whatsappService');

const ALERT_INTERVAL_DAYS = 5; // Re-alert every 5 days until paid

const getMonthlyFee = (classType, studentCategory) => {
  if (classType === 'Fitness Class') return 2000;
  if (classType === 'Online Class')  return studentCategory === 'Kids' ? 1600 : 2000;
  return studentCategory === 'Kids' ? 1000 : 1300;
};

/**
 * Core logic: find students with outstanding dues and fire WhatsApp reminders.
 *
 * Rules:
 *  (a) On the student's monthly fee-due date (anniversary day) → always alert if any due.
 *  (b) Student is overdue AND at least ALERT_INTERVAL_DAYS have passed since last alert.
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
    let rejoinSent    = 0;

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

      // Skip students who joined today — 5-day check handles their first follow-up
      const daysSinceJoin = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24));
      if (daysSinceJoin < 1) { alertsSkipped++; continue; }

      // ── Calculate dues ────────────────────────────────────────────────────
      let totalCycles =
        (today.getFullYear() - joinDate.getFullYear()) * 12 +
        (today.getMonth()    - joinDate.getMonth()) + 1;

      if (today.getDate() < joinDay) totalCycles--;
      if (totalCycles <= 0) continue; // Joined this month or future date — no dues yet

      const fee       = getMonthlyFee(student.classType, student.studentCategory);
      const totalPaid = paymentsByStudent.get(student._id.toString()) || 0;
      const totalDue  = Math.max(0, (totalCycles * fee) - totalPaid);

      if (totalDue <= 0) {
        // Fully paid — clear any stale lastAlertSent flag
        if (student.lastAlertSent) {
          await Student.updateOne({ _id: student._id }, { $unset: { lastAlertSent: '' } });
        }
        alertsSkipped++;
        continue;
      }

      const pendingMonths = Math.ceil(totalDue / fee);

      // Send only on anniversary day — the 5-day repeat check handles all other cadence.
      if (!isAnniversary) {
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
 * Every-5-days repeat reminder for ALL unpaid active students.
 *
 * Fires when:
 *   - Student has never been alerted (lastAlertSent is null) AND joined 5+ days ago, OR
 *   - Last alert was sent 5+ days ago AND student is still unpaid.
 *
 * Runs AFTER runPendingFeeAlerts so anniversary-day alerts (which set lastAlertSent=today)
 * are respected and not double-sent.
 */
async function runNewStudentPaymentCheck() {
  const today       = new Date();
  const fiveDaysAgo = new Date(today);
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - ALERT_INTERVAL_DAYS);
  fiveDaysAgo.setHours(23, 59, 59, 999); // cover students created at any time that day

  console.log(`\n🕘 [Scheduler] Running ${ALERT_INTERVAL_DAYS}-day repeat reminder check — ${today.toDateString()}`);

  try {
    // Fetch students who are due for a 5-day reminder:
    // (a) Never alerted and joined 5+ days ago, OR (b) last alert was 5+ days ago
    const candidates = await Student.find({
      isActive: { $ne: false },
      $or: [
        { lastAlertSent: null,              createdAt: { $lte: fiveDaysAgo } },
        { lastAlertSent: { $exists: false }, createdAt: { $lte: fiveDaysAgo } },
        { lastAlertSent: { $lte: fiveDaysAgo } }
      ]
    }).lean();

    if (candidates.length === 0) {
      console.log(`  ✅ No students due for a ${ALERT_INTERVAL_DAYS}-day reminder.`);
      return;
    }

    // Aggregate Monthly Fee payments for these candidates in one DB call
    const payments = await Payment.find({
      studentId: { $in: candidates.map(s => s._id) },
      purpose: 'Monthly Fee'
    }).select('studentId amount').lean();

    const paidMap = new Map();
    for (const p of payments) {
      const sid = p.studentId?.toString();
      if (sid) paidMap.set(sid, (paidMap.get(sid) || 0) + (p.amount || 0));
    }

    let sent    = 0;
    let skipped = 0;

    for (const student of candidates) {
      const joinDate = new Date(student.createdAt || student.joinDate);

      let totalCycles =
        (today.getFullYear() - joinDate.getFullYear()) * 12 +
        (today.getMonth()    - joinDate.getMonth()) + 1;
      if (today.getDate() < joinDate.getDate()) totalCycles--;
      if (totalCycles <= 0) { skipped++; continue; }

      const fee         = getMonthlyFee(student.classType, student.studentCategory);
      const totalPaid   = paidMap.get(student._id.toString()) || 0;
      const totalDue    = Math.max(0, totalCycles * fee - totalPaid);

      if (totalDue <= 0) {
        // Fully paid — clear stale flag
        if (student.lastAlertSent) {
          await Student.updateOne({ _id: student._id }, { $unset: { lastAlertSent: '' } });
        }
        skipped++;
        continue;
      }

      const pendingMonths = Math.ceil(totalDue / fee);
      const whatsappNum   = student.whatsappNumber || student.phone;
      if (!whatsappNum) { skipped++; continue; }

      try {
        const result = await whatsapp.sendPendingFeesAlert(
          student._id, whatsappNum, student.studentName, pendingMonths, totalDue
        );
        if (result.success) {
          await Student.updateOne({ _id: student._id }, { lastAlertSent: today });
          console.log(`  📲 ${ALERT_INTERVAL_DAYS}-day reminder → ${student.studentName} (₹${totalDue}, ${pendingMonths} month(s))`);
          sent++;
        } else {
          console.log(`  ⚠️  Skipped → ${student.studentName} — ${result.reason}`);
          skipped++;
        }
      } catch (err) {
        console.error(`  ❌ Failed for ${student.studentName}:`, err.message);
      }
    }

    console.log(`🔔 [Scheduler] ${ALERT_INTERVAL_DAYS}-day check done — ${sent} sent | ${skipped} skipped.\n`);
  } catch (err) {
    console.error(`❌ [Scheduler] Error during ${ALERT_INTERVAL_DAYS}-day check:`, err.message);
  }
}

/**
 * Start the scheduled job using native Node.js timers.
 * Fires daily at 22:30 UTC = 04:00 IST.
 * Uses setInterval instead of node-cron to avoid Intl/timezone crashes on Render.
 */
function startScheduler() {
  const TARGET_UTC_HOUR   = 22; // 22:30 UTC = 04:00 IST
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
    console.log(`⏰ [Scheduler] Next fee alert in ${hoursUntil}h (22:30 UTC = 04:00 IST)`);

    setTimeout(() => {
      // runPendingFeeAlerts fires first (anniversary day alerts, sets lastAlertSent)
      // runNewStudentPaymentCheck fires after — skips anyone already alerted today
      runPendingFeeAlerts();
      runNewStudentPaymentCheck();
      setInterval(() => {
        runPendingFeeAlerts();
        runNewStudentPaymentCheck();
      }, 24 * 60 * 60 * 1000);
    }, msUntilNext);
  };

  scheduleNext();
}

module.exports = { startScheduler, runPendingFeeAlerts, runNewStudentPaymentCheck };
