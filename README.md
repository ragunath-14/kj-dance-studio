# Deployment Instructions for Dance Studio Management System

This project has been consolidated into a unified structure in the root directory. It is production-ready and security-hardened.

---

## Architecture Overview

```
┌─────────────────────────┐    ┌──────────────────────────┐
│  Studio Frontend (Vite) │    │  Admin Frontend (Vite)   │
│  Public Registration    │    │  Dashboard + Management  │
│  Payment Portal         │    │  Students, Payments, Regs │
│  Path: /studio          │    │  Path: /admin           │
└────────────┬────────────┘    └────────────┬─────────────┘
             │                              │
             ▼                              ▼
┌─────────────────────────────────────────────────────────┐
│                 Unified Backend Server                  │
│                 (Node.js / Express)                     │
│                 Path: /backend                          │
│                                                         │
│  - Public Registration API                              │
│  - Admin Management API                                 │
│  - Automated Fee Alerts (Cron)                          │
│  - Socket.io Real-time Updates                          │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
                   ┌───────────────────┐
                   │  MongoDB Atlas    │
                   │  (Cloud Database) │
                   └───────────────────┘
```

---

## 1. Unified Backend (Node.js/Express)

Deploy the contents of `backend/` to **Render, Railway, or Heroku**.

### Environment Variables (Required)

| Variable         | Description                                                     | Example                                         |
| ---------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| `PORT`           | Server port (usually auto-set by host)                          | `5001`                                          |
| `MONGODB_URI`    | MongoDB Atlas connection string                                 | `mongodb+srv://user:pass@cluster.mongodb.net/`  |
| `NODE_ENV`       | Set to `production` for live deployment                         | `production`                                    |
| `TZ`             | Timezone for cron scheduler                                     | `Asia/Kolkata`                                  |
| `ALLOWED_ORIGINS`| Comma-separated frontend URLs for CORS                          | `https://studio.com,https://admin.com`          |
| `STUDIO_URL`     | Public studio URL (for WhatsApp payment links)                  | `https://studio.com`                            |
| `WHATSAPP_API_URL`| WhatsApp API endpoint                                           | `https://api.provider.com/send`                 |
| `WHATSAPP_API_KEY`| WhatsApp API key                                                | `your_api_key_here`                             |

---

## 2. Consolidated Frontend (React/Vite)

The frontend projects (both the Public Studio Landing Page and the Admin Management Panel) are fully consolidated under the `/studio` directory. 

In production, they are compiled into static assets and served directly by the Express backend.

### Automatic Production Build
When deploying the backend to Render, the build process automatically handles compilation:
- **Build Command:** `npm run build` (runs `node build-prod.js` inside `/backend` which builds the `/studio` project and installs dependencies).
- **Static Assets:** The compiled files reside in `/studio/dist/` and are served by the backend at `/` (landing page) and `/admin` (admin module).

---

## Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production` on the backend.
- [ ] Set `ALLOWED_ORIGINS` to your actual frontend domains.
- [ ] Set `TZ=Asia/Kolkata` for correct scheduling.
- [ ] Ensure `VITE_API_URL` is set before building frontends.
- [ ] Run `npm test` in the backend folder to verify logic.
- [ ] Check `/health` endpoint after deployment.

---

## Health Check

The backend exposes a `/health` endpoint:
`GET https://your-backend.onrender.com/health`
`→ { "status": "healthy", "db": "connected", "uptime": 1234.56, "version": "1.1.0 (Unified)" }`

---

## Fee Structure

| Class Type       | Category | Monthly Fee |
| ---------------- | -------- | ----------- |
| Regular Class    | Kids     | ₹1,000      |
| Regular Class    | Adults   | ₹1,300      |
| Online Class     | Kids     | ₹1,600      |
| Online Class     | Adults   | ₹2,000      |
| Fitness Class    | Adults   | ₹2,000      |

> **Note:** Kids = age ≤ 9 | Adults = age ≥ 10. Fitness Class is Adults-only.

---

## Security & Reliability

- ✅ Helmet.js protection enabled.
- ✅ CORS restricted to whitelisted origins.
- ✅ Automated 09:00 AM IST Fee Alerts.
- ✅ Graceful shutdown handling.
- ✅ Real-time data sync via Socket.io.
