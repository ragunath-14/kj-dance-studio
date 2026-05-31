# Model Context README

This file is a compact project map for AI/model sessions. Read this first to avoid spending tokens re-discovering the same structure.

## Project Summary

KJ / Expressionz Dance Studio is a full-stack dance studio management system.

- Public website: student/parent landing page and registration form.
- Admin dashboard: login, students, payments, pending registrations, activity, unpaid fees.
- Backend: Express REST API, MongoDB via Mongoose, Socket.io real-time events, WhatsApp reminders.
- Production: Express serves the built React app from `studio/dist`.

## Root Structure

```txt
kj-dance-studio/
  backend/       Node.js + Express API
  studio/        React + Vite frontend, public site + admin app
  README.md      deployment-focused README
  PRIVACY.md     privacy policy
```

## Backend

Main entry:

```txt
backend/index.js
```

Key folders:

```txt
backend/controllers/
backend/models/
backend/routes/
backend/middleware/
backend/services/
backend/whatsapp-tools/
backend/__tests__/
```

Main packages:

- `express`
- `mongoose`
- `socket.io`
- `jsonwebtoken`
- `helmet`
- `express-rate-limit`
- `axios`
- `node-cron`

Important backend files:

```txt
backend/index.js                         server, middleware, routes, static frontend serving
backend/scheduler.js                     daily pending-fee WhatsApp alerts
backend/middleware/auth.js               admin JWT verification
backend/services/whatsappService.js      WhatsApp sending logic
backend/controllers/studentController.js student CRUD, stats, unpaid dues
backend/controllers/paymentController.js payment CRUD, reminders
backend/controllers/registrationController.js public registration approval flow
```

## Frontend

Frontend app:

```txt
studio/
```

Main entry:

```txt
studio/src/App.jsx
```

Routes:

```txt
/          public website
/admin/*   admin dashboard
```

Important frontend files:

```txt
studio/src/App.jsx                       root router
studio/src/config.js                     API base URL, defaults to /api
studio/src/components/                   public website sections
studio/src/components/RegisterModal.jsx  public registration form
studio/src/admin/AdminModule.jsx         admin routes and auth wrapper
studio/src/admin/context/DataContext.jsx admin API fetches, socket refresh, toasts
studio/src/admin/components/             admin dashboard UI
```

## Database Models

```txt
backend/models/Registration.js
backend/models/Student.js
backend/models/Payment.js
```

Collections:

- `registrations`: pending, approved, rejected registration requests.
- `students`: approved students.
- `payments`: fee/payment records.

Core fields:

- Student: `studentName`, `phone`, `whatsappNumber`, `classType`, `createdAt`, `isActive`, `lastAlertSent`.
- Registration: similar to Student, plus `status`.
- Payment: `studentId`, `amount`, `date`, `method`, `purpose`, `remainingFees`.

## API Map

Public:

```txt
GET  /health
POST /api/register
GET  /api/students/:id/public-dues
```

Admin auth:

```txt
POST /api/admin/login
```

Protected admin APIs:

```txt
/api/students
/api/payments
/api/registrations
```

Useful specific routes:

```txt
GET    /api/students/dashboard/stats
GET    /api/students/unpaid
PATCH  /api/students/:id/toggle-status
GET    /api/registrations/pending
POST   /api/registrations/:id/approve
POST   /api/registrations/:id/reject
POST   /api/payments/send-pending-alerts
POST   /api/payments/send-reminder/:studentId
POST   /api/admin/trigger-fee-alerts
```

## Business Flow

1. Public user submits the registration modal.
2. Frontend calls `POST /api/register`.
3. Backend saves a pending `Registration`.
4. Admin dashboard receives a Socket.io `dataChanged` event.
5. Admin approves the registration.
6. Backend creates a `Student` from the `Registration`.
7. Admin records payments against the student.
8. Dashboard calculates revenue, overdue students, and activity.
9. WhatsApp sends confirmations and fee reminders when configured.

## Fee Logic

Monthly fee helper appears in multiple files:

```js
const getMonthlyFee = (classType) => classType === 'Fitness Class' ? 2500 : 3500;
```

Meaning:

- Fitness Class: INR 2500/month
- Dance Class and Regular Class: INR 3500/month

Dues are calculated by:

- student join date from `createdAt`
- number of monthly cycles passed
- total paid where `purpose === 'Monthly Fee'`

## Real-Time Updates

Backend emits Socket.io events after important mutations:

```txt
dataChanged
registrationApproved
```

Admin `DataContext.jsx` listens and refreshes dashboard/list data with a short debounce.

## WhatsApp

WhatsApp is handled in:

```txt
backend/services/whatsappService.js
```

Used for:

- registration received confirmation
- registration approval welcome message
- payment confirmation
- pending fee alert

Scheduler:

```txt
backend/scheduler.js
```

Runs daily at 03:30 UTC, equivalent to 09:00 IST.

## Environment

Backend important env vars:

```txt
PORT
MONGODB_URI
ADMIN_PASSWORD
JWT_SECRET
NODE_ENV
ALLOWED_ORIGINS
STUDIO_URL
WHATSAPP_API_URL
WHATSAPP_API_KEY
WEBHOOK_VERIFY_TOKEN
```

Frontend important env vars:

```txt
VITE_API_URL
VITE_SOCKET_URL
```

Default frontend API URL:

```js
import.meta.env.VITE_API_URL || '/api'
```

## Common Commands

Backend:

```txt
cd backend
npm run dev
npm start
npm test
npm run build
```

Frontend:

```txt
cd studio
npm run dev
npm run build
npm run lint
npm run preview
```

Production build:

```txt
cd backend
npm run build
```

This runs `backend/build-prod.js`, installs/builds the frontend, and outputs static files to `studio/dist`.

## Notes For Future Model Sessions

- Do not scan `node_modules`.
- Start with this file, then inspect only the relevant controller/component.
- The admin app is inside the same Vite project as the public site.
- The old standalone admin `studio/src/admin/App.jsx` exists, but the active route uses `studio/src/admin/AdminModule.jsx`.
- Avoid changing fee logic in only one file; `getMonthlyFee` is duplicated in controllers and scheduler.
- Some comments in existing files show mojibake characters from encoding issues; avoid broad formatting churn unless explicitly requested.
- Secrets may exist in `backend/.env`; do not print or commit them.
- Existing README is deployment-focused. This file is for quick engineering/model context.
