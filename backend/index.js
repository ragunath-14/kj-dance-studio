/**
 * backend/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Expressionz Dance Studio — Unified Backend Server
 *
 * Architecture:
 *   • Express REST API  → /api/*
 *   • Socket.io         → Real-time dashboard updates
 *   • Static serving    → Serves studio/dist (React SPA + /admin route)
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
const jwt        = require('jsonwebtoken');
const { Server } = require('socket.io');
require('dotenv').config();

// ── Route & Controller Imports ───────────────────────────────────────────────
const studentRoutes          = require('./routes/studentRoutes');
const paymentRoutes          = require('./routes/paymentRoutes');
const registrationRoutes     = require('./routes/registrationRoutes');
const registrationController = require('./controllers/registrationController');
const studentController      = require('./controllers/studentController');
const { verifyAdminToken }   = require('./middleware/auth');
const { startScheduler, runPendingFeeAlerts } = require('./scheduler');

// ── App & Server Setup ───────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5001;

// ── CORS — Open to all origins ───────────────────────────────────────────────
// Allows any frontend (localhost dev, production domain, mobile apps) to connect.
// Restrict this post-launch by setting ALLOWED_ORIGINS in .env if needed.
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS === '*' || !process.env.ALLOWED_ORIGINS
    ? '*'
    : process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, { cors: corsOptions });
app.set('socketio', io);

// ── Core Middleware ──────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.set('trust proxy', 1);

// ── Rate Limiters ────────────────────────────────────────────────────────────
const registrationLimiter = rateLimit({
  windowMs : 15 * 60 * 1000, // 15 minutes
  max      : 15,
  message  : { success: false, message: 'Too many registration attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders  : false
});

const apiLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 200,
  standardHeaders: true,
  legacyHeaders  : false
});

// ── Public Routes ────────────────────────────────────────────────────────────

// Health check (used by deployment platforms / uptime monitors)
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.status(dbState === 1 ? 200 : 503).json({
    status : dbState === 1 ? 'healthy' : 'unhealthy',
    db     : dbState === 1 ? 'connected' : 'disconnected',
    uptime : Math.round(process.uptime()),
    version: '1.2.0'
  });
});

// Student registration form (public — rate limited)
app.post('/api/register', registrationLimiter, registrationController.createPendingRegistration);

// Public dues check (used by student payment portal, no auth needed)
app.get('/api/students/:id/public-dues', studentController.getStudentDues);

// ── Admin Authentication ─────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, token });
});

// ── Protected API Routes ─────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/students',     verifyAdminToken, studentRoutes);
app.use('/api/payments',     verifyAdminToken, paymentRoutes);
app.use('/api/registrations',verifyAdminToken, registrationRoutes);

// ── Admin Tools ──────────────────────────────────────────────────────────────
// Manually trigger the fee-alert scheduler (useful for testing)
app.post('/api/admin/trigger-fee-alerts', verifyAdminToken, async (req, res) => {
  try {
    console.log('🔧 Manual trigger: running pending-fee alerts...');
    await runPendingFeeAlerts();
    res.json({ success: true, message: 'Fee alert job executed. Check server logs.' });
  } catch (err) {
    console.error('Fee alert trigger error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── WhatsApp Webhook (Meta Cloud API) ────────────────────────────────────────
// GET — Meta calls this to verify the webhook endpoint during setup
app.get('/api/webhook', (req, res) => {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'dance_studio_123';
  const mode        = req.query['hub.mode'];
  const token       = req.query['hub.verify_token'];
  const challenge   = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Meta Webhook verified.');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST — Meta sends delivery status updates here
app.post('/api/webhook', (req, res) => {
  const body = req.body;
  if (!body?.object) return res.sendStatus(404);

  const statuses = body.entry?.[0]?.changes?.[0]?.value?.statuses;
  if (statuses?.length) {
    const s = statuses[0];
    console.log(`\n📬 WhatsApp delivery update — ID: ${s.id} | Status: ${s.status} | To: ${s.recipient_id}`);
    if (s.errors) console.error('   Meta error:', JSON.stringify(s.errors));
  }
  res.sendStatus(200);
});

// ── Serve React SPA (Production) ─────────────────────────────────────────────
// The studio build includes both the public portal (/) and admin panel (/admin/*)
app.use(express.static(path.join(__dirname, '../studio/dist')));
app.get(/^(?!\/api|\/health).*$/, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../studio/dist/index.html'));
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err.stack || err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

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
