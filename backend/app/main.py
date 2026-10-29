"""
Khata Management System – FastAPI Application Factory
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import engine, Base, get_db
from app.models import User, BusinessSetting  # noqa: F401 – import models so metadata is populated
from app.security import hash_password
from app.routers import auth, users, customers, products, invoices, payments, adjustments, reports, audit, settings as settings_router
from sqlalchemy.orm import Session

settings_cfg = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all tables and seed default admin + business settings on startup.

    Tests override `get_db` with an in-memory SQLite engine, so the real
    database is neither reachable nor wanted during the test run.
    """
    if get_db in app.dependency_overrides:
        yield
        return

    Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        # Seed or update admin user credentials
        admin = db.query(User).filter(
            (User.username == "utsavpatel788190@gmail.com")
            | (User.email == "utsavpatel788190@gmail.com")
            | (User.username == "admin")
        ).first()

        if not admin:
            admin = User(
                username="utsavpatel788190@gmail.com",
                full_name="Utsav Patel (Administrator)",
                email="utsavpatel788190@gmail.com",
                hashed_password=hash_password("Utsav@8148"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
        else:
            admin.username = "utsavpatel788190@gmail.com"
            admin.email = "utsavpatel788190@gmail.com"
            admin.full_name = "Utsav Patel (Administrator)"
            admin.hashed_password = hash_password("Utsav@8148")
            admin.is_active = True
            admin.role = "admin"
        db.commit()

        # Seed default business settings
        defaults = {
            "business_name": settings_cfg.business_name,
            "currency_symbol": settings_cfg.business_currency_symbol,
            "timezone": settings_cfg.business_timezone,
            "invoice_prefix": "INV",
            "receipt_prefix": "RCP",
            "allow_advance_payments": "true",
        }
        for key, value in defaults.items():
            if not db.query(BusinessSetting).filter_by(key=key).first():
                db.add(BusinessSetting(key=key, value=value))

        db.commit()

    yield  # application runs here


is_prod = settings_cfg.app_env.lower() == "production"

app = FastAPI(
    title="Khata Management System API",
    description="Complete credit ledger & accounting system – FastAPI + MySQL",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if is_prod else "/api/docs",
    redoc_url=None if is_prod else "/api/redoc",
    openapi_url=None if is_prod else "/api/openapi.json",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings_cfg.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
for pfx in ("/api/v1", "/api"):
    app.include_router(auth.router, prefix=pfx)
    app.include_router(users.router, prefix=pfx)
    app.include_router(customers.router, prefix=pfx)
    app.include_router(products.router, prefix=pfx)
    app.include_router(invoices.router, prefix=pfx)
    app.include_router(payments.router, prefix=pfx)
    app.include_router(adjustments.router, prefix=pfx)
    app.include_router(reports.router, prefix=pfx)
    app.include_router(audit.router, prefix=pfx)
    app.include_router(settings_router.router, prefix=pfx)


@app.get("/api/health")
def health():
    return {"status": "UP", "service": "Khata Management System v2 (FastAPI + SQL)"}


# ─── Built React client (production mode) ─────────────────────────────────────
# Registered last so every /api route keeps priority. In development Vite serves
# the UI on :5173 and proxies /api here, so nothing is mounted.
_CLIENT_DIST = Path(__file__).resolve().parents[2] / "client" / "dist"

if (_CLIENT_DIST / "index.html").is_file():
    app.mount(
        "/assets",
        StaticFiles(directory=_CLIENT_DIST / "assets"),
        name="assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        """Serve built assets, falling back to index.html for client-side routes."""
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")

        candidate = (_CLIENT_DIST / full_path).resolve()
        if (_CLIENT_DIST in candidate.parents
                and candidate.is_file()):
            return FileResponse(candidate)
        return FileResponse(_CLIENT_DIST / "index.html")
