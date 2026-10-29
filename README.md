# Khata Management System

> Production-Grade Credit Ledger, Multi-Product Invoicing, and Partial Payment Allocation Accounting System inspired by Khata Book.

[![Tests](https://img.shields.io/badge/Pytest-25%20Passed-emerald.svg)](backend/tests)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111%2B-teal.svg)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/SQLAlchemy-MariaDB%20%2F%20MySQL-orange.svg)](https://www.sqlalchemy.org/)
[![React](https://img.shields.io/badge/React-18%20%2B%20Vite-cyan.svg)](https://vitejs.dev/)

---

## 🌟 Executive Summary

Khata Management System is designed for retail and wholesale businesses (such as agricultural stores, fertilizer depots, and merchant distributors) that supply products to customers on credit with partial and installment settlements.

### Key Capabilities:
- **Zero Floating-Point Inaccuracies**: Decimal precision calculations (`DECIMAL(15,2)`).
- **Two Distinct Payment Modes**:
  1. **Mode 1 (Simple Payment)**: Reduces overall customer Baaki immediately without requiring invoice association.
  2. **Mode 2 (Invoice-Wise Payment)**: Allocates payment amounts across one or more invoices with **zero double-counting**.
- **Customer Khata Ledgers**: Chronological bank-passbook style running balances with color-coded debit (sales) and credit (payments).
- **Multi-Product Invoicing**: Snapshot-based line items (quantity, unit, unit price, line total) protecting past invoices from catalog price changes.
- **Role-Based Access Control (RBAC)**: Distinct permissions for `admin`, `manager`, and `staff`.
- **Forensic Audit Logging**: Authorized cancellation and audit trail logging preserving history.
- **Single Unified Backend**: Clean Python FastAPI service handling all business logic, credit ledgers, and database transactions.

---

## 🚀 Quick Start Guide

### 1. Requirements
- Python 3.10+
- Node.js v18+
- MariaDB / MySQL instance (e.g. XAMPP on port 3307 or MySQL on port 3306)

### 2. Install Dependencies
```bash
# Frontend
npm run install:all

# Backend
cd backend
pip install -r requirements.txt
cd ..
```

### 3. Execute Automated Test Suite
```bash
npm test
```
*Executes all 25 automated pytest tests.*

### 4. Start Development Server
```bash
npm run dev
```
- **Frontend App**: `http://localhost:5173`
- **Backend API & Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Health Check**: `http://127.0.0.1:8000/health`

---

## 🔑 Default Credentials (Development)

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full administrative access, business settings, staff management |

*Default admin and business settings are automatically created on startup if they don't already exist.*

---

## 📐 Project Structure

```
KHATA MANAGEMENT/
├── client/                     # Vite + React 18 + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/         # StatCard, Badge, Modal, ConfirmDialog, ReceiptModal, InvoicePrintModal
│   │   ├── context/            # AuthContext (JWT + LocalStorage)
│   │   ├── layouts/            # DashboardLayout, Sidebar, Navbar
│   │   ├── pages/              # Customers, Products, Invoices, Payments, Reports, Staff, AuditLogs, Settings
│   │   ├── services/           # Axios API services (proxied to FastAPI backend)
│   │   └── utils/              # Formatting & Sanitization utilities
│   └── package.json
│
├── backend/                    # Python FastAPI + SQLAlchemy 2.x + Alembic (Single Unified Backend)
│   ├── app/
│   │   ├── config.py           # Environment and DB config
│   │   ├── database.py         # SQLAlchemy engine and session provider
│   │   ├── dependencies.py     # Auth, RBAC, DB session dependencies
│   │   ├── main.py             # FastAPI entrypoint, CORS, static mounting
│   │   ├── models.py           # SQLAlchemy relational models
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── security.py         # Passlib bcrypt hashing & python-jose JWT
│   │   └── routers/            # Auth, Users, Customers, Products, Invoices, Payments, Adjustments, Reports, Audit, Settings
│   ├── tests/                  # Pytest test suite (25 tests)
│   ├── alembic/                # Database migrations
│   └── requirements.txt
│
├── docs/                       # Architectural documentation
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🛡️ License
ISC License. Built for Khata Management Engineering.
