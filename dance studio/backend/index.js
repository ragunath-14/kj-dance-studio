const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

// Route Imports
const studentRoutes = require('./routes/studentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const registrationController = require('./controllers/registrationController');
const studentController = require('./controllers/studentController');
const { startScheduler, runPendingFeeAlerts } = require('./scheduler');
// const whatsappWebClient = require('./services/whatsappWebClient');
const { verifyAdminToken } = require('./middleware/auth');
const jwt = require('jsonwebtoken');


const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Dynamic CORS based on environment
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set('socketio', io);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for easier dev/deployment if needed, or configure strictly
}));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.set('trust proxy', 1);

// ── Rate Limiters ───────────────────────────────────────────────────────────
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 registration attempts per window per IP
  message: { success: false, message: 'Too many registration attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // General API rate limit
  standardHeaders: true,
  legacyHeaders: false
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// Public Registration (Submit form) — stricter rate limit
app.post('/api/register', registrationLimiter, registrationController.createPendingRegistration);

// ── Admin Authentication ──────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Public route for student dues check (used by payment portal — no auth needed)
app.get('/api/students/:id/public-dues', studentController.getStudentDues);

// Admin / Dashboard Routes (Protected)
app.use('/api/students', verifyAdminToken, studentRoutes);
app.use('/api/payments', verifyAdminToken, paymentRoutes);
app.use('/api/registrations', verifyAdminToken, registrationRoutes);

// ── Manual Admin Tools ───────────────────────────────────────────────────────
app.post('/api/admin/trigger-fee-alerts', verifyAdminToken, async (req, res) => {
  try {
    console.log('🔧 Manual trigger: running pending-fee alerts now...');
    await runPendingFeeAlerts();
    res.json({ success: true, message: 'Fee alert job executed. Check server logs.' });
  } catch (err) {
    console.error('Fee alert trigger error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── WhatsApp Webhook (Meta) ──────────────────────────────────────────────────
// GET route for Meta to verify the webhook
app.get('/api/webhook', (req, res) => {
  const verify_token = "dance_studio_123"; // You will enter this in the Meta dashboard
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verify_token) {
      console.log("✅ Meta Webhook Verified!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// POST route to receive delivery status from Meta
app.post('/api/webhook', (req, res) => {
  const body = req.body;
  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.statuses) {
      const status = body.entry[0].changes[0].value.statuses[0];
      console.log('\n--- 🔔 META DELIVERY STATUS UPDATE ---');
      console.log('Message ID:', status.id);
      console.log('Recipient:', status.recipient_id);
      console.log('Status:', status.status);
      if (status.errors) {
        console.error('❌ EXACT META ERROR:', JSON.stringify(status.errors, null, 2));
      }
      console.log('--------------------------------------\n');
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// ── Health & Status ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const status = dbState === 1 ? 'healthy' : 'unhealthy';
  res.status(dbState === 1 ? 200 : 503).json({
    status,
    db: dbState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    version: '1.1.0 (Unified)'
  });
});



// ── Serving Frontend (Unified SPA) ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../studio/dist')));

// Fallback routing for React (SPA)
app.get(/^(?!\/api|\/health).*$/, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../studio', 'dist', 'index.html'));
});

// ── Error Handling ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack || err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Database & Server Start ─────────────────────────────────────────────────
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dance-studio';
mongoose.connect(mongoURI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    io.on('connection', (socket) => {
      console.log('⚡ Client connected:', socket.id);
      socket.on('disconnect', () => console.log('🔌 Client disconnected'));
    });

    startScheduler();

    server.listen(PORT, () => {
      console.log(`🚀 Unified server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Graceful Shutdown ───────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n🛑 ${signal} received — shutting down gracefully...`);
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('📦 MongoDB connection closed.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };

// Harmless comment to trigger nodemon auto-restart
