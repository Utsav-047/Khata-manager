"""Audit logs router (read-only, admin only)."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog
from app.schemas import AuditLogOut
from app.dependencies import AdminUser

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=List[AuditLogOut])
def list_audit_logs(
    *,
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    current_user: AdminUser,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        q = q.filter(AuditLog.resource_id == resource_id)
    return q.order_by(AuditLog.created_at.desc()).limit(limit).all()
