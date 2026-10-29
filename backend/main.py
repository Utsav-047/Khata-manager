"""
Khata Management System – FastAPI Backend
Entry point: uvicorn app.main:app --reload
"""
from app.main import app  # noqa: F401 – re-exported for uvicorn
