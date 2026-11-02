/**
 * backend/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Expressionz Dance Studio — Unified Backend Server
 *
 * Architecture:
 *   • Express REST API  → /api/*
 *   • Socket.io         → Real-time dashboard updates
 *   • Static serving    → Serves frontend/dist (React SPA + /admin route)
 *   • WhatsApp          → Meta Cloud API (controlled via USE_META_API env flag)
 *   • Scheduler         → Daily fee-reminder cron job
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const http       = require('http');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const crypto     = require('crypto');
const { Server } = require('socket.io');
require('dotenv').config();

// ── Route & Controller Imports ───────────────────────────────────────────────
const studentRoutes          = require('./routes/studentRoutes');
const paymentRoutes          = require('./routes/paymentRoutes');
const registrationRoutes     = require('./routes/registrationRoutes');
const attendanceRoutes       = require('./routes/attendanceRoutes');
const campRoutes             = require('./routes/campRoutes');
const authRoutes             = require('./routes/authRoutes');
const registrationController = require('./controllers/registrationController');
const studentController      = require('./controllers/studentController');
const campController         = require('./controllers/campController');
const settingsController     = require('./controllers/settingsController');
const Student                = require('./models/Student');
const { verifyAdminToken, verifySocketToken } = require('./middleware/auth');
const { sanitizeRequest }    = require('./middleware/sanitize');
const { startScheduler, runPendingFeeAlerts } = require('./scheduler');
const whatsapp               = require('./services/whatsappService');

// ── Refuse to start without a usable signing secret ──────────────────────────
// Every admin login token is signed with JWT_SECRET; a missing or guessable one would let anyone forge a login.
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set. Add a long random string to the environment and restart.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET is too short for production (use at least 32 random characters).');
  process.exit(1);
}

// ── App & Server Setup ───────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5001;

// ── CORS ─────────────────────────────────────────────────────────────────────
// ALLOWED_ORIGINS="https://a.com,https://b.com" -> only those sites may call the API from a browser.
// ALLOWED_ORIGINS="*"                           -> any site (development / tests only).
// Not set: open in development, but in production only this server's own pages (same origin) are allowed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(o => o && o !== '*');
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS === '*'
    ? '*'
    : allowedOrigins.length
      ? allowedOrigins
      : process.env.NODE_ENV === 'production' ? false : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, { cors: corsOptions });
io.use(verifySocketToken);   // only a logged-in admin may listen to live updates
app.set('socketio', io);

// ── Core Middleware ──────────────────────────────────────────────────────────
// Content-Security-Policy: the page may only load its own scripts, Google Fonts and https images, and may
// not be shown inside another site's frame. This limits what injected script could do.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc    : ["'self'"],
      scriptSrc     : ["'self'"],
      styleSrc      : ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc       : ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc        : ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc    : ["'self'", 'ws:', 'wss:', ...allowedOrigins],
      objectSrc     : ["'none'"],
      baseUri       : ["'self'"],
      formAction    : ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(cors(corsOptions));
// rawBody is kept only so the WhatsApp webhook signature can be checked
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeRequest);   // removes MongoDB operators ($ne, $gt ...) from body, query and params
app.set('trust proxy', 1);

// ── Rate Limiters ────────────────────────────────────────────────────────────
// Automated tests make hundreds of calls in seconds; they set DISABLE_RATE_LIMIT=true.
// The switch is ignored in production so it can never switch protection off on the live site.
const skipRateLimit = () => process.env.DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production';

const registrationLimiter = rateLimit({
  windowMs : 15 * 60 * 1000, // 15 minutes
  max      : 15,
  message  : { success: false, message: 'Too many registration attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders  : false,
  skip           : skipRateLimit
});

// Referral lookups take a phone number, so keep them slow to scrape
const referralLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 40,
  message  : { success: false, valid: false, message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders  : false,
  skip           : skipRateLimit
});

const apiLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 200,
  standardHeaders: true,
  legacyHeaders  : false,
  skip           : skipRateLimit
});

// Login: 10 wrong guesses per 15 minutes per IP (successful logins are not counted)
const loginLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 10,
  skipSuccessfulRequests: true,
  message  : { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders  : false,
  skip           : skipRateLimit
});

// Creating / replacing a referral code only needs a phone number, so it is limited much harder:
// 10 tries an hour per IP stops someone cycling other students' codes.
const referralWriteLimiter = rateLimit({
  windowMs : 60 * 60 * 1000,
  max      : 10,
  message  : { success: false, message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders  : false,
  skip           : skipRateLimit
});

// ── Public Routes ────────────────────────────────────────────────────────────

// Health check (used by deployment platforms / uptime monitors)
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const waStatus = whatsapp.getStatus();
  res.status(dbState === 1 ? 200 : 503).json({
    status   : dbState === 1 ? 'healthy' : 'unhealthy',
    db       : dbState === 1 ? 'connected' : 'disconnected',
    uptime   : Math.round(process.uptime()),
    version  : '1.2.0',
    whatsapp : waStatus
  });
});

// Student registration form (public — rate limited)
app.post('/api/register', registrationLimiter, registrationController.createPendingRegistration);

// Summer camp registration (public — rate limited, rejected while camp is switched off)
app.post('/api/camp/register', registrationLimiter, campController.createCampRegistration);

// Referral programme: look up a student by phone, create a code, check a code (public — rate limited)
app.use(['/api/referral/generate', '/api/referral/regenerate'], referralWriteLimiter);
app.use('/api/referral', referralLimiter, require('./routes/referralRoutes'));

// ── Auth Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);

// ── WhatsApp Template Test (admin only) ──────────────────────────────────────
app.post('/api/test-whatsapp', verifyAdminToken, async (req, res) => {
  const { phone, name, template } = req.body;
  if (!phone) return res.status(400).json({ message: 'phone is required' });
  try {
    let result;
    switch (template) {
      case 'fee_reminder':
        result = await whatsapp.sendPendingFeesAlert(null, phone, name || 'Student', 1, 1300);
        break;
      case 'payment_receipt':
        result = await whatsapp.sendPaymentConfirmation(phone, name || 'Student', 1300, 'Monthly Fee', new Date().toLocaleDateString('en-IN'));
        break;
      case 'registration_received':
        result = await whatsapp.sendRegistrationConfirmation(phone, name || 'Student', 'Regular Class');
        break;
      case 'camp_confirmation':
        result = await whatsapp.sendCampConfirmation(phone, name || 'Student');
        break;
      default:
        result = await whatsapp.sendWelcomeMessage(phone, name || 'Student', 'Regular Class', 'TBA');
    }
    res.json({ success: result.success, usedFallback: result.usedFallback || false, detail: result });
  } catch (err) {
    console.error('test-whatsapp error:', err);
    res.status(500).json({ success: false, message: 'Could not send the test message.' });
  }
});

// ── Protected API Routes ─────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// Public studio switches (landing page reads this to show/hide the camp section)
app.get('/api/settings/public', settingsController.getPublicSettings);
app.put('/api/settings/camp', verifyAdminToken, settingsController.setCampEnabled);

app.get('/api/dashboard/stats', verifyAdminToken, studentController.getDashboardStats);
app.use('/api/students',     verifyAdminToken, studentRoutes);
app.use('/api/payments',     verifyAdminToken, paymentRoutes);
app.use('/api/registrations',verifyAdminToken, registrationRoutes);
app.use('/api/attendance',   verifyAdminToken, attendanceRoutes);
app.use('/api/camp',         verifyAdminToken, campRoutes);
app.use('/api/referrals',    verifyAdminToken, require('./routes/referralAdminRoutes'));

// ── Admin Tools ──────────────────────────────────────────────────────────────
// Manually trigger the fee-alert scheduler (useful for testing)
app.post('/api/admin/trigger-fee-alerts', verifyAdminToken, async (req, res) => {
  try {
    console.log('🔧 Manual trigger: running pending-fee alerts...');
    await runPendingFeeAlerts();
    res.json({ success: true, message: 'Fee alert job executed. Check server logs.' });
  } catch (err) {
    console.error('Fee alert trigger error:', err);
    res.status(500).json({ success: false, message: 'Could not run the fee alert job.' });
  }
});

// ── WhatsApp Webhook (Meta Cloud API) ────────────────────────────────────────
// GET — Meta calls this to verify the webhook endpoint during setup
app.get('/api/webhook', (req, res) => {
  // No built-in fallback token: if WEBHOOK_VERIFY_TOKEN is not set, verification is refused
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
  const mode        = req.query['hub.mode'];
  const token       = req.query['hub.verify_token'];
  const challenge   = req.query['hub.challenge'];

  if (verifyToken && mode === 'subscribe' && typeof token === 'string' && token === verifyToken) {
    console.log('✅ Meta Webhook verified.');
    return res.status(200).type('text/plain').send(String(challenge ?? ''));   // plain text: the challenge can never be rendered as HTML
  }
  res.sendStatus(403);
});

// POST — Meta sends delivery status updates here
app.post('/api/webhook', (req, res) => {
  // When WHATSAPP_APP_SECRET is set, only requests signed by Meta (X-Hub-Signature-256) are accepted
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody || '').digest('hex');
    const given    = String(req.headers['x-hub-signature-256'] || '');
    const ok = given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!ok) return res.sendStatus(403);
  }
  const body = req.body;
  if (!body?.object) return res.sendStatus(404);

  const statuses = body.entry?.[0]?.changes?.[0]?.value?.statuses;
  if (statuses?.length) {
    const s = statuses[0];
    // Anyone can POST here, so keep only short plain text in the log (no line breaks = no forged log lines)
    const safe = (v) => String(v ?? '').replace(/[^\w.:@=-]/g, '').slice(0, 80);
    console.log(`\n📬 WhatsApp delivery update — ID: ${safe(s.id)} | Status: ${safe(s.status)} | To: ${safe(s.recipient_id)}`);
    if (s.errors) console.error('   Meta error:', JSON.stringify(s.errors).slice(0, 500));
  }
  res.sendStatus(200);
});

// ── Serve React SPA (Production) ─────────────────────────────────────────────
// Serves both the public landing page (/) and admin panel (/admin/*)
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get(/^(?!\/api|\/health).*$/, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/dist/index.html'));
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err.stack || err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Keep-Alive Ping (Runs every 5 minutes to keep Render / MongoDB active) ──
const startKeepAlive = () => {
  console.log('💓 [Keep-Alive] Keep-alive service initialized (every 5 mins).');
  setInterval(async () => {
    try {
      // 1. Keep Database Hot - Get students from DB
      if (mongoose.connection.readyState === 1) {
        const studentCount = await Student.countDocuments();
        // Also fetch one student to simulate real data access
        await Student.findOne().lean();
        console.log(`💓 [Keep-Alive] DB Query successful. Total Students in DB: ${studentCount}`);
      }
      
      // 2. Self-ping only in production when a real URL is explicitly configured
      const selfUrl = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
      if (selfUrl) {
        const urlToPing = selfUrl.replace(/\/$/, '');
        const httpLib = urlToPing.startsWith('https') ? require('https') : require('http');
        httpLib.get(urlToPing, (res) => {
          console.log(`💓 [Keep-Alive] Frontend ping: ${res.statusCode}`);
        }).on('error', (err) => {
          console.error('❌ [Keep-Alive] Frontend ping failed:', err.message);
        });
        httpLib.get(`${urlToPing}/health`, (res) => {
          console.log(`💓 [Keep-Alive] Backend ping: ${res.statusCode}`);
        }).on('error', (err) => {
          console.error('❌ [Keep-Alive] Backend ping failed:', err.message);
        });
      }
    } catch (err) {
      console.error('❌ [Keep-Alive] Error during keep-alive ping:', err.message);
    }
  }, 5 * 60 * 1000); // 5 minutes
};

// ── Database & Server Start ───────────────────────────────────────────────────
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dance-studio';

mongoose.connect(mongoURI)
  .then(() => {
    console.log('✅ Connected to MongoDB');

    io.on('connection', socket => {
      console.log(`⚡ Admin connected: ${socket.id}`);
      socket.on('disconnect', () => console.log(`🔌 Admin disconnected: ${socket.id}`));
    });

    startScheduler();
    startKeepAlive();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
      console.log(`📡 WhatsApp: ${process.env.USE_META_API === 'true' ? 'ENABLED' : 'DISABLED (USE_META_API=false)'}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = signal => {
  console.log(`\n🛑 ${signal} — shutting down gracefully...`);
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('📦 MongoDB connection closed.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10000); // Force exit after 10s
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = { app, server };
