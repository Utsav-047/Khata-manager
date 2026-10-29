"""Business settings router."""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.models import (
    BusinessSetting,
    PaymentAllocation,
    Payment,
    InvoiceItem,
    Invoice,
    CreditAdjustment,
    AuditLog,
    Customer,
)
from app.schemas import SettingUpdate, SettingOut
from app.dependencies import CurrentUser, AdminUser

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=List[SettingOut])
def get_settings(current_user: CurrentUser,
                 db: Session = Depends(get_db)):
    return db.query(BusinessSetting).order_by(BusinessSetting.key).all()


@router.put("", response_model=List[SettingOut])
def update_settings(updates: List[SettingUpdate], current_user: AdminUser,
                    db: Session = Depends(get_db)):
    for upd in updates:
        existing = (db.query(BusinessSetting)
                    .filter(BusinessSetting.key == upd.key).first())
        if existing:
            existing.value = upd.value
        else:
            db.add(BusinessSetting(key=upd.key, value=upd.value))
    db.commit()
    return db.query(BusinessSetting).order_by(BusinessSetting.key).all()


@router.post("/reset-history")
def reset_transaction_history(current_user: AdminUser, db: Session = Depends(get_db)):
    """Wipes all invoices, payments, allocations, adjustments, and audit logs."""
    if db.bind and db.bind.dialect.name == "mysql":
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        db.execute(text("TRUNCATE TABLE payment_allocations;"))
        db.execute(text("TRUNCATE TABLE payments;"))
        db.execute(text("TRUNCATE TABLE invoice_items;"))
        db.execute(text("TRUNCATE TABLE invoices;"))
        db.execute(text("TRUNCATE TABLE credit_adjustments;"))
        db.execute(text("TRUNCATE TABLE audit_logs;"))
        db.execute(text("UPDATE customers SET opening_balance = 0.00;"))
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
    else:
        db.query(PaymentAllocation).delete()
        db.query(Payment).delete()
        db.query(InvoiceItem).delete()
        db.query(Invoice).delete()
        db.query(CreditAdjustment).delete()
        db.query(AuditLog).delete()
        db.query(Customer).update({Customer.opening_balance: 0.00})
    db.commit()
    return {"success": True, "message": "All transaction history cleared and balances reset to 0"}
