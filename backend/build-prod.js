#!/usr/bin/env node
/**
 * build-prod.js
 * Run this to create a production-ready build.
 * Usage: cd backend && node build-prod.js
 *
 * What it does:
 *  1. Builds the frontend React SPA (public portal + /admin)
 *  2. Installs backend production dependencies
 *  3. Prints deployment checklist
 */

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT        = __dirname;
const FRONTEND_DIR = path.join(ROOT, '..', 'frontend');

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function check(dir, name) {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Directory not found: ${dir}`);
    process.exit(1);
  }
  console.log(`✅ Found ${name}`);
}

console.log('\n🏗️  KJ Dance Studio — Production Build');
console.log('='.repeat(50));

// ── Validate dirs ──────────────────────────────────
check(FRONTEND_DIR, 'frontend/');

// ── Build frontend ─────────────────────────────────
console.log('\n📦 Step 1: Building frontend...');
run('npm install --prefer-offline', FRONTEND_DIR);
run('npm run build', FRONTEND_DIR);

// ── Verify build output ────────────────────────────
const distDir = path.join(FRONTEND_DIR, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ Build failed — frontend/dist not found.');
  process.exit(1);
}
console.log(`\n✅ Frontend build complete! Files: ${fs.readdirSync(distDir).join(', ')}`);

// ── Install backend deps ───────────────────────────
console.log('\n📦 Step 2: Installing backend dependencies...');
run('npm install --production', ROOT);

// ── Summary ───────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log('✅ Build complete!\n');
console.log('  Frontend : frontend/dist/  (served by Express)');
console.log('  Backend  : backend/index.js');
console.log('\n🚀 To start production server:');
console.log('   NODE_ENV=production node backend/index.js');
console.log('\n📋 Pre-deployment checklist:');
console.log('   □ Set ALLOWED_ORIGINS to your production domain in .env');
console.log('   □ Set SELF_URL to your production domain (for keep-alive ping)');
console.log('   □ Set NODE_ENV=production');
console.log('   □ Set USE_META_API=true (WhatsApp enabled)');
console.log('   □ Confirm JWT_SECRET is strong and unique');
console.log('   □ MongoDB Atlas: whitelist your server IP');
console.log('   □ WhatsApp templates kj_welcome / kj_payment / kj_rejoin — auto-activate once Meta approves');
console.log('='.repeat(50) + '\n');
