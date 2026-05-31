#!/usr/bin/env node
/**
 * build-prod.js  — KJ Dance Studio
 * ─────────────────────────────────
 * Run from the backend directory:
 *   node build-prod.js
 *   OR  npm run build
 *
 * What it does:
 *  1. Validates the project structure
 *  2. Installs frontend dependencies
 *  3. Builds the React frontend → frontend/dist/
 *  4. Installs backend production dependencies
 *  5. Prints deployment instructions
 *
 * Production URL layout (single Render/Railway service):
 *   https://your-app.onrender.com/           → React SPA (frontend)
 *   https://your-app.onrender.com/admin/*    → React SPA (admin panel)
 *   https://your-app.onrender.com/api/*      → Express REST API
 *   https://your-app.onrender.com/health     → Health check
 *   https://your-app.onrender.com/socket.io  → WebSocket (Socket.IO)
 */

'use strict';

const { execSync } = require('child_process');
const path  = require('path');
const fs    = require('fs');

// ── Paths ─────────────────────────────────────────────────────────────────────
const BACKEND_DIR  = __dirname;                              // backend/
const FRONTEND_DIR = path.join(BACKEND_DIR, '../frontend'); // frontend/
const DIST_DIR     = path.join(FRONTEND_DIR, 'dist');       // frontend/dist/

// ── Helpers ───────────────────────────────────────────────────────────────────
const run = (cmd, cwd, opts = {}) => {
  console.log(`\n  $ ${cmd}  (in ${path.basename(cwd)})`);
  execSync(cmd, { cwd, stdio: 'inherit', ...opts });
};

const checkDir = (dir, label) => {
  if (!fs.existsSync(dir)) {
    console.error(`\n❌ Required directory not found: ${dir}`);
    console.error(`   Make sure you are running this from the backend/ directory.\n`);
    process.exit(1);
  }
  console.log(`  ✅ Found ${label}`);
};

const separator = (char = '─', len = 55) => console.log(char.repeat(len));

// ── Start ─────────────────────────────────────────────────────────────────────
console.log('\n');
separator('═');
console.log('  🏗️   KJ Dance Studio — Production Build');
separator('═');
console.log(`\n  Backend  : ${BACKEND_DIR}`);
console.log(`  Frontend : ${FRONTEND_DIR}`);
console.log(`  Output   : ${DIST_DIR}`);
console.log('');

// ── Step 0: Validate structure ────────────────────────────────────────────────
console.log('Step 0 — Validating project structure...');
checkDir(FRONTEND_DIR,                         'frontend/');
checkDir(path.join(FRONTEND_DIR, 'src'),       'frontend/src/');
checkDir(path.join(FRONTEND_DIR, 'package.json').replace('package.json', ''), '');
if (!fs.existsSync(path.join(FRONTEND_DIR, 'package.json'))) {
  console.error('❌ frontend/package.json not found.');
  process.exit(1);
}
console.log('  ✅ Structure OK\n');

// ── Step 1: Install frontend deps ─────────────────────────────────────────────
separator();
console.log('Step 1 — Installing frontend dependencies...');
separator();
run('npm ci', FRONTEND_DIR);

// ── Step 2: Build frontend ────────────────────────────────────────────────────
separator();
console.log('Step 2 — Building React frontend (production mode)...');
separator();
run('npm run build', FRONTEND_DIR);

// ── Verify build output ───────────────────────────────────────────────────────
if (!fs.existsSync(DIST_DIR)) {
  console.error('\n❌ Build failed — frontend/dist/ was not created.');
  process.exit(1);
}

const distFiles = fs.readdirSync(DIST_DIR);
const indexHtml = path.join(DIST_DIR, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('\n❌ Build failed — frontend/dist/index.html missing.');
  process.exit(1);
}

const distSize = getFolderSize(DIST_DIR);
console.log(`\n  ✅ Frontend built! ${distFiles.length} files in dist/ (${(distSize / 1024).toFixed(1)} KB total)`);
console.log(`     Files: ${distFiles.join(', ')}`);

// ── Step 3: Install backend prod deps ─────────────────────────────────────────
separator();
console.log('Step 3 — Installing backend production dependencies...');
separator();
run('npm install --production', BACKEND_DIR);
console.log('\n  ✅ Backend dependencies installed (production only)\n');

// ── Step 4: Verify .env ───────────────────────────────────────────────────────
separator();
console.log('Step 4 — Checking environment config...');
separator();
const envFile   = path.join(BACKEND_DIR, '.env');
const envExists = fs.existsSync(envFile);
console.log(envExists
  ? '  ✅ .env file found'
  : '  ⚠️  No .env file found. Make sure env vars are set on your host.'
);

const required = ['MONGODB_URI', 'JWT_SECRET', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'];
if (envExists) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  required.forEach(key => {
    const found = envContent.includes(`${key}=`) && !envContent.includes(`${key}=\n`);
    console.log(found ? `  ✅ ${key}` : `  ⚠️  ${key} — missing or empty`);
  });
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log('');
separator('═');
console.log('  ✅ Build complete!');
separator('═');

console.log('\n  📦 What was built:\n');
console.log('     frontend/dist/    ← React SPA (served by Express at /)');
console.log('     backend/          ← Express API server\n');

console.log('  🚀 URL layout after deployment:\n');
console.log('     /                 → React app (homepage / public site)');
console.log('     /admin/*          → React admin panel');
console.log('     /api/*            → Express REST API');
console.log('     /health           → Health check (JSON)');
console.log('     /socket.io        → WebSocket (real-time updates)\n');

console.log('  🖥️  To run production server locally:\n');
console.log('     cd backend');
console.log('     NODE_ENV=production npm start\n');

console.log('  ☁️  Render deployment settings:\n');
console.log('     Root directory : backend/');
console.log('     Build command  : npm run build');
console.log('     Start command  : npm start');
console.log('     NODE_ENV       : production\n');

console.log('  📋 Pre-deployment checklist:\n');
const checks = [
  'Set MONGODB_URI (MongoDB Atlas connection string)',
  'Set JWT_SECRET (strong random string)',
  'Set ALLOWED_ORIGINS to your production domain (or remove for same-origin)',
  'Set USE_META_API=true once WhatsApp templates are APPROVED',
  'Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID',
  'Whitelist your Render server IP in MongoDB Atlas',
];
checks.forEach(c => console.log(`     □ ${c}`));

console.log('');
separator('═');
console.log('');

// ── Util: folder size ─────────────────────────────────────────────────────────
function getFolderSize(dirPath) {
  let total = 0;
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const full = path.join(dirPath, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) total += getFolderSize(full);
      else total += stat.size;
    }
  } catch (_) { /* ignore */ }
  return total;
}
