# Deployment Instructions for Dance Studio Management System

This project has been consolidated into a unified structure within the `dance studio` folder. It is production-ready and security-hardened.

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

Deploy the contents of `dance studio/backend/` to **Render, Railway, or Heroku**.

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

## 2. Studio Landing Page (React/Vite)

Deploy the contents of `dance studio/studio/` to **Vercel or Netlify**.

### Environment Variables

| Variable            | Description                                     | Example                                      |
| ------------------- | ----------------------------------------------- | -------------------------------------------- |
| `VITE_API_URL`      | Backend URL + /api                              | `https://your-backend.onrender.com/api`      |
| `VITE_ADMIN_API_URL`| Backend URL + /api (for PayPortal)              | `https://your-backend.onrender.com/api`      |

### Build Command
```bash
npm run build
```

---

## 3. Admin Panel (React/Vite)

Deploy the contents of `dance studio/admin/` to **Vercel or Netlify**.

### Environment Variables

| Variable       | Description                          | Example                                       |
| -------------- | ------------------------------------ | --------------------------------------------- |
| `VITE_API_URL` | Backend URL + /api                   | `https://your-backend.onrender.com/api`       |

### Build Command
```bash
npm run build
```

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

## Security & Reliability

- ✅ Helmet.js protection enabled.
- ✅ CORS restricted to whitelisted origins.
- ✅ Automated 09:00 AM IST Fee Alerts.
- ✅ Graceful shutdown handling.
- ✅ Real-time data sync via Socket.io.
