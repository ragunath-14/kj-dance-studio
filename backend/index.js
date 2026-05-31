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
  res.json({ message: 'Dance Studio Unified API is running' });
});

// ── Production Frontend Serving ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../studio/dist')));
  app.get(/^(?!\/api|\/health).*$/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../studio', 'dist', 'index.html'));
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
