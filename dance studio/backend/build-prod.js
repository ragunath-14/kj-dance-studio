#!/usr/bin/env node
/**
 * build-prod.js
 * Run this to create a production-ready build.
 * Usage: node build-prod.js
 *
 * What it does:
 *  1. Builds the Studio frontend (React SPA, includes /admin route)
 *  2. The backend serves studio/dist in production
 *  3. Prints next steps for deployment
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const STUDIO_DIR = path.join(ROOT, '..', 'studio');

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

console.log('\n🏗️  Expressionz Dance Studio — Production Build');
console.log('='.repeat(50));

// ── Validate dirs ─────────────────────────────────
check(STUDIO_DIR, 'studio/');

// ── Build Studio (includes /admin route) ─────────
console.log('\n📦 Step 1: Building Studio frontend...');
run('npm install --prefer-offline', STUDIO_DIR);
run('npm run build', STUDIO_DIR);

// ── Verify build output ───────────────────────────
const distDir = path.join(STUDIO_DIR, 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ Build failed — studio/dist not found.');
  process.exit(1);
}
const distFiles = fs.readdirSync(distDir);
console.log(`\n✅ Studio build complete! Files in dist: ${distFiles.join(', ')}`);

// ── Install backend deps ──────────────────────────
console.log('\n📦 Step 2: Installing backend dependencies...');
run('npm install --production', ROOT);

// ── Summary ──────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log('✅ Build complete! Production summary:\n');
console.log('  Frontend : studio/dist/ (served by Express)');
console.log('  Backend  : backend/index.js');
console.log('\n🚀 To start production server:');
console.log('   NODE_ENV=production node backend/index.js');
console.log('\n📋 Pre-deployment checklist:');
console.log('   □ Copy .env.example → .env and fill all values');
console.log('   □ Set ALLOWED_ORIGINS to your production domain');
console.log('   □ Set STUDIO_URL to your production domain');
console.log('   □ Set USE_META_API=true only when WhatsApp templates are APPROVED');
console.log('   □ Set a strong ADMIN_PASSWORD and JWT_SECRET');
console.log('   □ Make sure MongoDB Atlas IP whitelist includes your server IP');
console.log('='.repeat(50) + '\n');
