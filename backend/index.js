const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

// Route Imports
const studentRoutes = require('./routes/studentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const authRoutes = require('./routes/authRoutes');
const registrationController = require('./controllers/registrationController');
const { startScheduler, runPendingFeeAlerts } = require('./scheduler');
const whatsapp = require('./services/whatsappService');

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

// ── API Routes ──────────────────────────────────────────────────────────────
const auth = require('./middleware/auth');

// Public Registration (Submit form)
app.post('/api/register', registrationController.createPendingRegistration);

// WhatsApp test (admin only)
app.post('/api/test-whatsapp', auth, async (req, res) => {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ message: 'phone is required' });
  try {
    const result = await whatsapp.sendWelcomeMessage(
      phone,
      name || 'Test Student',
      'Dance Class'
    );
    res.json({ success: result.success, detail: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/whatsapp/messages/:messageId', auth, (req, res) => {
  const status = whatsapp.getMessageStatus(req.params.messageId);
  if (!status) return res.status(404).json({ message: 'Message status not found on this server instance.' });
  return res.json(status);
});

// Meta WhatsApp webhook verification.
app.get('/api/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'dance_studio_123';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp webhook] Verified by Meta.');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Meta sends message delivery status updates here: sent, delivered, read, failed.
app.post('/api/webhook', (req, res) => {
  try {
    whatsapp.handleWebhook(req.body);
    return res.sendStatus(200);
  } catch (err) {
    console.error('[WhatsApp webhook] Handler error:', err.message);
    return res.sendStatus(200);
  }
});

// Global Dashboard Stats (Protected)
const studentController = require('./controllers/studentController');
app.get('/api/dashboard/stats', auth, studentController.getDashboardStats);
app.get('/api/students/unpaid', auth, studentController.getUnpaidStudents);

// Admin / Dashboard Routes (All Protected)
app.use('/api/students', auth, studentRoutes);
app.use('/api/payments', auth, paymentRoutes);
app.use('/api/registrations', auth, registrationRoutes);
app.use('/api/auth', authRoutes);

// ── Health & Status ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const status = dbState === 1 ? 'healthy' : 'unhealthy';
  const waStatus = whatsapp.getStatus();
  res.status(dbState === 1 ? 200 : 503).json({
    status,
    db: dbState === 1 ? 'connected' : 'disconnected',
    whatsapp: waStatus,
    uptime: process.uptime(),
    version: '1.1.0 (Unified)'
  });
});

app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') return;
  res.json({ message: 'KJ Dance Studio API is running. Frontend served at same URL in production.' });
});

// ── Production Frontend Serving ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  // All non-API, non-health, non-socket routes → React SPA
  app.get(/^(?!\/api|\/health|\/socket\.io).*$/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

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

    // Start WhatsApp client after DB is ready
    whatsapp.initWhatsApp();
    
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
const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received — shutting down gracefully...`);
  await whatsapp.destroyWhatsApp();
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
