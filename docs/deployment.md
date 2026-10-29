# Khata Management System - Deployment & Operations Guide

## 1. Prerequisites
- **Python**: 3.10+ (tested on Python 3.12 / 3.14)
- **Node.js**: v18.0.0 or higher
- **MySQL / MariaDB**: e.g., XAMPP MariaDB or MySQL 8.0+

---

## 2. Environment Configuration

The backend reads configuration from `.env` (or `backend/.env`):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DB_HOST` | Database host | `127.0.0.1` |
| `DB_PORT` | Database port | `3307` |
| `DB_USER` | Database username | `root` |
| `DB_PASSWORD` | Database password | `""` |
| `DB_NAME` | Database schema name | `khata_management` |
| `SECRET_KEY` | Cryptographic secret for JWT tokens | `changeme` |
| `ALGORITHM` | JWT hashing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session token lifetime in minutes | `480` |
| `APP_ENV` | Application environment | `development` |
| `ALLOWED_ORIGINS` | Permitted CORS origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `BUSINESS_NAME` | Business name display | `My Shop` |
| `BUSINESS_CURRENCY_SYMBOL`| Business currency symbol | `₹` |
| `BUSINESS_TIMEZONE` | Business timezone | `Asia/Kolkata` |

---

## 3. Installation & Setup

1. **Install Python backend dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

2. **Install frontend dependencies**:
   ```bash
   npm run install:all
   ```

3. **Database Migration / Table Setup**:
   Tables and initial default administrator credentials (`admin` / `admin123`) and business settings are automatically initialized on startup by FastAPI lifecycle hooks.
   To run Alembic migrations manually:
   ```bash
   npm run migrate
   ```

4. **Run Automated Tests**:
   ```bash
   npm test
   ```

---

## 4. Running the Application

### Local Development Mode
Runs FastAPI backend on `http://127.0.0.1:8000` with hot-reload and Vite React frontend on `http://localhost:5173`:
```bash
npm run dev
```

- **Frontend App**: `http://localhost:5173`
- **Backend API & Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Health Check**: `http://127.0.0.1:8000/health`

### Production Run
```bash
npm run build
npm start
```
FastAPI automatically serves the built React frontend from `client/dist` and mounts the API under `/api`.
