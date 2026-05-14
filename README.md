# 🚀 Payapult — Full-Stack Payroll Software

Multi-country payroll SaaS built with **React + Vite**, **Node.js/Express**, and **PostgreSQL**.

---

## 📁 Project Structure

```
payapult/
├── backend/                 # Node.js Express API
│   ├── config/
│   │   ├── database.js      # PostgreSQL pool
│   │   └── logger.js        # Winston logger
│   ├── db/
│   │   ├── schema.sql       # Full DB schema (run first)
│   │   └── seed.js          # Demo data seeder
│   ├── middleware/
│   │   ├── auth.js          # JWT authentication
│   │   └── errorHandler.js  # Global error handler
│   ├── routes/
│   │   ├── auth.js          # Login, refresh, me
│   │   ├── employees.js     # Employee CRUD
│   │   ├── payRuns.js       # Payroll engine
│   │   ├── leave.js         # Leave management
│   │   ├── loans.js         # Loans + Advances
│   │   ├── analytics.js     # Dashboard + Reports
│   │   ├── documents.js     # File uploads
│   │   └── settings.js      # Org config
│   ├── server.js            # Express entry point
│   ├── package.json
│   └── .env.example
│
└── frontend/                # React + Vite app
    ├── src/
    │   ├── api/
    │   │   └── client.js    # Axios + all API modules
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── TopBar.jsx
    │   │   └── UI.jsx       # Design system components
    │   ├── hooks/
    │   │   └── useData.js   # useFetch, useMutation, usePagination
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Employees.jsx
    │   │   ├── PayRuns.jsx
    │   │   ├── Analytics.jsx
    │   │   ├── Leave.jsx
    │   │   ├── Loans.jsx
    │   │   ├── Advances.jsx
    │   │   ├── Documents.jsx
    │   │   ├── Reports.jsx
    │   │   └── Settings.jsx
    │   ├── store/
    │   │   └── useStore.js  # Zustand auth store
    │   ├── App.jsx          # Router + layout
    │   └── main.jsx         # Entry point
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## ⚡ Quick Start

### 1 — Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **PostgreSQL** 14+ — [postgresql.org](https://postgresql.org)

### 2 — Database Setup

```bash
# Create database
createdb payapult_db

# Run schema
psql -U postgres -d payapult_db -f backend/db/schema.sql
```

### 3 — Backend

```bash
cd backend
cp .env.example .env          # Edit DB credentials and JWT secrets
npm install
node db/seed.js               # Seed demo data
npm run dev                   # Starts on http://localhost:5000
```

### 4 — Frontend

```bash
cd frontend
cp .env.example .env          # Set VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                   # Starts on http://localhost:5173
```

Open **http://localhost:5173** and login with:

```
Email:    admin@payapult.com
Password: Admin@123
```

---

## 🔑 Environment Variables

### Backend `.env`

| Variable | Description |
|---|---|
| `DB_HOST` | PostgreSQL host (default: localhost) |
| `DB_NAME` | Database name |
| `DB_USER` | DB username |
| `DB_PASSWORD` | DB password |
| `JWT_SECRET` | Secret for access tokens (64+ chars) |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `PORT` | API port (default: 5000) |
| `FRONTEND_URL` | Frontend URL for CORS |

### Frontend `.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |

---

## 📡 API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login — returns JWT + refresh token |
| POST | `/api/auth/refresh` | Refresh access token |
| GET  | `/api/auth/me` | Current user profile |
| POST | `/api/auth/logout` | Logout and clear token |

### Employees
| Method | Path | Description |
|---|---|---|
| GET  | `/api/employees` | List with search/filter/paginate |
| POST | `/api/employees` | Create employee |
| GET  | `/api/employees/:id` | Employee detail + salary + leaves |
| PUT  | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Soft deactivate |

### Pay Runs
| Method | Path | Description |
|---|---|---|
| GET  | `/api/pay-runs` | List all pay runs |
| POST | `/api/pay-runs` | Create + auto-calculate |
| GET  | `/api/pay-runs/:id` | Detail with employee breakdown |
| POST | `/api/pay-runs/:id/approve` | Approve |
| POST | `/api/pay-runs/:id/mark-paid` | Mark paid, generate payslips |
| DELETE | `/api/pay-runs/:id` | Cancel |

### Leave
| Method | Path | Description |
|---|---|---|
| GET  | `/api/leave` | All leave requests |
| GET  | `/api/leave/balances` | Leave balances by employee |
| POST | `/api/leave` | Create request |
| POST | `/api/leave/:id/approve` | Approve |
| POST | `/api/leave/:id/reject` | Reject |

### Loans & Advances
| Method | Path | Description |
|---|---|---|
| GET  | `/api/loans` | List loans |
| POST | `/api/loans` | Create loan |
| POST | `/api/loans/:id/approve` | Approve + generate schedule |
| GET  | `/api/loans/:id/schedule` | Repayment schedule |
| GET  | `/api/advances` | List advances |
| POST | `/api/advances` | Create advance |
| POST | `/api/advances/:id/approve` | Approve |

### Analytics
| Method | Path | Description |
|---|---|---|
| GET  | `/api/analytics/dashboard` | Dashboard summary stats |
| GET  | `/api/analytics/payroll` | Monthly payroll trends |
| GET  | `/api/analytics/headcount` | Headcount breakdowns |
| GET  | `/api/analytics/reports/:type` | payroll-detail, leave-summary, loan-status |

### Settings
| Method | Path | Description |
|---|---|---|
| GET  | `/api/settings/organization` | Org details |
| PUT  | `/api/settings/organization` | Update org |
| GET/POST | `/api/settings/departments` | Departments CRUD |
| GET  | `/api/settings/salary-components` | Salary components |
| POST | `/api/settings/salary-components` | Add component |
| GET  | `/api/settings/leave-policies` | Leave policies |
| GET  | `/api/settings/users` | Org users |

---

## 🗄️ Database Schema

18 tables covering the full payroll lifecycle:

- `organizations` — multi-tenant root
- `users` — auth with JWT refresh tokens
- `employees` — full employee master (bank, tax, statutory)
- `departments`, `designations`, `work_locations`
- `salary_components`, `employee_salary_structures`
- `pay_runs`, `pay_run_items` — payroll engine
- `leave_policies`, `leave_balances`, `leave_requests`
- `loans`, `loan_repayments`
- `salary_advances`
- `documents`, `payslips`
- `audit_logs`, `notifications`, `exchange_rates`

---

## 🌍 Multi-Country Support

- 13 currencies (AED, USD, GBP, EUR, INR, SAR, QAR, KWD, PKR, EGP, NGN, CNY, KRW)
- Per-employee currency and timezone
- Work location with country code + timezone
- Organization-level fiscal year and pay day config

---

## 🔒 Security

- JWT access tokens (7d) + refresh tokens (30d)
- bcrypt password hashing (cost 12)
- Helmet security headers
- CORS with allowlist
- Rate limiting (100 req/15min global, 20 req/15min auth)
- Org isolation — users can only access their own org's data
- Role-based access control: `super_admin`, `admin`, `hr_manager`, `accountant`, `employee`

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Zustand, Axios, Recharts |
| Backend | Node.js, Express 4, express-validator, multer, node-cron |
| Database | PostgreSQL 14+, pg pool |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Logging | Winston |
| Dev | nodemon |
