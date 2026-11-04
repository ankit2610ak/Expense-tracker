# ExpenseTrack Pro - Full-Stack Expense Tracker

A modern, fast, and secure full-stack Expense Tracker web application built with **React 18 + Vite**, **Node.js + Express (TypeScript)**, and **SQLite**.

---

## Features

- **User Authentication**: Secure user registration, password hashing (bcrypt), and JSON Web Token (JWT) sessions. Each user's transactions and settings are private and completely isolated.
- **Opening & Closing Balance Tracking**:
  - Configurable **Baseline Opening Balance** (e.g. initial bank/wallet balance).
  - Accurate **Period-Based Opening Balance**: calculates the cumulative rollover from all prior credits and expenses before the selected timeframe.
  - Live **Closing Balance**: $\text{Opening Balance} + \text{Period Credits} - \text{Period Expenses}$.
- **Expense & Credit Recording**:
  - Fast, intuitive quick-entry form.
  - Select transaction type: **Expense** (outflow) or **Credit** (inflow).
  - Assign categories with color-coded badges and icons.
  - Ability to create custom categories on the fly.
  - Record date and optional description notes.
- **Interactive Visual Dashboard**:
  - Timeframe toggles for **Weekly** (7-day daily breakdown) and **Monthly** (month weekly timeline).
  - Expense vs. Credit comparison bar charts (via Recharts).
  - Expense category distribution donut chart with percentage breakdown.
- **Filtering & Search**:
  - Filter by transaction type: *All*, *Expenses*, or *Credits*.
  - Filter by category.
  - Instant text search across descriptions and notes.
- **Persistent Local Database**:
  - Built-in SQLite database (`expense_tracker.db`), zero configuration required.
  - Data reloads cleanly and accurately every time the user logs in.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Axios |
| **Backend** | Node.js, Express, TypeScript, JWT (`jsonwebtoken`), `bcryptjs`, CORS |
| **Database** | SQLite (`node:sqlite` / ACID compliant, relational schema with foreign keys) |
| **Testing** | Vitest, Supertest |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher (Node v22 / v26 supported)
- [npm](https://www.npmjs.com/) v10 or higher

---

## Quick Start & Running the Project

### 1. Install Dependencies

From the project root:

```bash
npm run install:all
```

*(Or individually inside `backend` and `frontend` using `npm install`)*

### 2. Start the Application

To run both the backend API server and frontend client concurrently:

```bash
npm run dev
```

- **Frontend Client**: [http://localhost:3000](http://localhost:3000)
- **Backend API Server**: [http://localhost:4000](http://localhost:4000)

*(The frontend automatically proxies `/api` calls to the backend on port 4000)*

---

## Running the Automated Tests

The application includes automated integration and logic tests for authentication, category assignment, transaction CRUD, balance rollovers, and dashboard statistics:

```bash
npm test
```

Or inside the `backend` folder:

```bash
cd backend
npm test
```

---

## Building for Production

To compile both backend TypeScript and frontend Vite assets:

```bash
npm run build
```

---

## Project Structure

```
Expense tracker/
├── package.json              # Monorepo / convenience scripts (dev, build, test)
├── README.md                 # Project documentation & setup instructions
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts      # Test runner configuration
│   ├── src/
│   │   ├── index.ts          # Server entry point
│   │   ├── app.ts            # Express application setup
│   │   ├── types/            # TypeScript interfaces
│   │   ├── db/
│   │   │   ├── database.ts   # SQLite database connection & schema
│   │   │   └── seed.ts       # Preset category seeders
│   │   ├── middleware/
│   │   │   └── auth.ts       # JWT authentication middleware
│   │   └── routes/
│   │       ├── auth.ts       # Register, login, me, settings
│   │       ├── transactions.ts # CRUD & filtered transaction queries
│   │       ├── categories.ts # Default & custom categories
│   │       └── dashboard.ts  # Weekly/monthly summary & balances
│   └── tests/
│       ├── auth.test.ts      # Authentication tests
│       ├── balances.test.ts  # Balance computation & rollup tests
│       └── transactions.test.ts # Transaction CRUD & filter tests
└── frontend/
    ├── package.json
    ├── vite.config.ts        # Vite config with API proxy
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types/            # Frontend interfaces
        ├── services/api.ts   # Axios API client with auth interceptors
        ├── context/          # React AuthContext session manager
        └── components/
            ├── Navbar.tsx
            ├── BalanceCards.tsx
            ├── TransactionForm.tsx
            ├── FilterBar.tsx
            ├── DashboardCharts.tsx
            ├── TransactionList.tsx
            ├── SettingsModal.tsx
            └── AuthScreen.tsx
```

---

## API Overview

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Create account with initial opening balance
- `POST /api/auth/login` - Authenticate and receive JWT
- `GET /api/auth/me` - Get current user profile and settings (Protected)
- `PUT /api/auth/settings` - Update baseline opening balance and currency (Protected)

### Transactions (`/api/transactions`)
- `GET /api/transactions` - Filtered transactions list with category, type, date range, search (Protected)
- `POST /api/transactions` - Create an expense or credit (Protected)
- `PUT /api/transactions/:id` - Update a transaction (Protected)
- `DELETE /api/transactions/:id` - Delete a transaction (Protected)

### Categories (`/api/categories`)
- `GET /api/categories` - Fetch system default and user custom categories (Protected)
- `POST /api/categories` - Create a custom category (Protected)

### Dashboard (`/api/dashboard`)
- `GET /api/dashboard/summary?period=week|month|all` - Opening balance, closing balance, totals, time series, category breakdown (Protected)

