"""Credit adjustments (discount / write-off / return charges)."""
from decimal import Decimal
from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import CreditAdjustment, Customer
from app.schemas import AdjustmentCreate, AdjustmentOut
from app.dependencies import CurrentUser, ManagerUser, add_audit

router = APIRouter(prefix="/adjustments", tags=["adjustments"])


def _next_adj_number(db: Session) -> str:
    count = db.query(func.count(CreditAdjustment.id)).scalar() or 0
    return f"ADJ-{count + 1:05d}"


@router.get("", response_model=List[AdjustmentOut])
def list_adjustments(
    *,
    customer_id: Optional[int] = Query(None),
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    q = db.query(CreditAdjustment)
    if customer_id:
        q = q.filter(CreditAdjustment.customer_id == customer_id)
    return q.order_by(CreditAdjustment.adj_date.desc()).all()


@router.post("", response_model=AdjustmentOut, status_code=status.HTTP_201_CREATED)
def create_adjustment(body: AdjustmentCreate, current_user: ManagerUser,
                      db: Session = Depends(get_db)):
    customer = db.get(Customer, body.customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")

    adj = CreditAdjustment(
        adj_number=_next_adj_number(db),
        created_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(adj)
    db.flush()
    add_audit(db, current_user, "create_adjustment", "adjustment", adj.id,
              f"{body.adj_type.value} ₹{body.amount} for {customer.name}: {body.reason}")
    db.commit()
    db.refresh(adj)
    return adj


@router.delete("/{adj_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_adjustment(adj_id: int, current_user: ManagerUser,
                      db: Session = Depends(get_db)):
    adj = db.get(CreditAdjustment, adj_id)
    if not adj:
        raise HTTPException(404, "Adjustment not found")
    add_audit(db, current_user, "delete_adjustment", "adjustment", adj_id)
    db.delete(adj)
    db.commit()
