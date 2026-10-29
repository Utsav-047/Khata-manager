"""Customers router with ledger computation."""
from decimal import Decimal
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models import Customer, Invoice, Payment, CreditAdjustment, AdjustmentType, InvoiceStatus
from app.schemas import (
    CustomerCreate, CustomerUpdate, CustomerOut,
    CustomerLedger, CustomerLedgerEntry
)
from app.dependencies import CurrentUser, add_audit

router = APIRouter(prefix="/customers", tags=["customers"])

ZERO = Decimal("0.00")


def _next_customer_code(db: Session) -> str:
    count = db.query(func.count(Customer.id)).scalar() or 0
    return f"CUST-{count + 1:04d}"


def _get_customer_financial_query(db: Session):
    """Subquery-based join to get all financial sums per customer cleanly."""
    inv_totals = (
        db.query(
            Invoice.customer_id.label("customer_id"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("invoiced"),
        )
        .filter(Invoice.status != InvoiceStatus.cancelled)
        .group_by(Invoice.customer_id)
        .subquery()
    )

    pay_totals = (
        db.query(
            Payment.customer_id.label("customer_id"),
            func.coalesce(func.sum(Payment.amount), 0).label("paid"),
        )
        .group_by(Payment.customer_id)
        .subquery()
    )

    adj_totals = (
        db.query(
            CreditAdjustment.customer_id.label("customer_id"),
            func.coalesce(
                func.sum(
                    case(
                        (CreditAdjustment.adj_type == AdjustmentType.debit, CreditAdjustment.amount),
                        else_=0,
                    )
                ), 0
            ).label("debit_adj"),
            func.coalesce(
                func.sum(
                    case(
                        (CreditAdjustment.adj_type == AdjustmentType.credit, CreditAdjustment.amount),
                        else_=0,
                    )
                ), 0
            ).label("credit_adj"),
        )
        .group_by(CreditAdjustment.customer_id)
        .subquery()
    )

    return (
        db.query(
            Customer,
            func.coalesce(inv_totals.c.invoiced, 0).label("invoiced"),
            func.coalesce(pay_totals.c.paid, 0).label("paid"),
            func.coalesce(adj_totals.c.debit_adj, 0).label("debit_adj"),
            func.coalesce(adj_totals.c.credit_adj, 0).label("credit_adj"),
        )
        .outerjoin(inv_totals, inv_totals.c.customer_id == Customer.id)
        .outerjoin(pay_totals, pay_totals.c.customer_id == Customer.id)
        .outerjoin(adj_totals, adj_totals.c.customer_id == Customer.id)
    )


def _enrich_single_customer(c: Customer, db: Session) -> CustomerOut:
    """Helper to convert Customer to CustomerOut with computed financial aggregates."""
    inv_total = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(
        Invoice.customer_id == c.id,
        Invoice.status != InvoiceStatus.cancelled,
    ).scalar() or ZERO

    pay_total = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.customer_id == c.id
    ).scalar() or ZERO

    debit_adj = db.query(func.coalesce(func.sum(CreditAdjustment.amount), 0)).filter(
        CreditAdjustment.customer_id == c.id,
        CreditAdjustment.adj_type == AdjustmentType.debit,
    ).scalar() or ZERO

    credit_adj = db.query(func.coalesce(func.sum(CreditAdjustment.amount), 0)).filter(
        CreditAdjustment.customer_id == c.id,
        CreditAdjustment.adj_type == AdjustmentType.credit,
    ).scalar() or ZERO

    total_debits = Decimal(str(inv_total)) + Decimal(str(debit_adj))
    total_credits = Decimal(str(pay_total)) + Decimal(str(credit_adj))
    current_balance = Decimal(str(c.opening_balance)) + total_debits - total_credits

    out = CustomerOut.model_validate(c)
    out.current_balance = current_balance
    out.total_debits = total_debits
    out.total_credits = total_credits
    return out


@router.get("", response_model=List[CustomerOut])
def list_customers(
    *,
    q: Optional[str] = Query(None, description="Name/phone/code search"),
    active_only: bool = True,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    query = _get_customer_financial_query(db)

    if active_only:
        query = query.filter(Customer.is_active.is_(True))

    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            Customer.name.ilike(search_pattern)
            | Customer.phone.ilike(search_pattern)
            | Customer.code.ilike(search_pattern)
            | Customer.city.ilike(search_pattern)
        )

    rows = query.order_by(Customer.name).all()
    results = []
    for c, invoiced, paid, debit_adj, credit_adj in rows:
        total_debits = Decimal(str(invoiced or 0)) + Decimal(str(debit_adj or 0))
        total_credits = Decimal(str(paid or 0)) + Decimal(str(credit_adj or 0))
        current_balance = Decimal(str(c.opening_balance or 0)) + total_debits - total_credits

        out = CustomerOut.model_validate(c)
        out.current_balance = current_balance
        out.total_debits = total_debits
        out.total_credits = total_credits
        results.append(out)

    return results


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    body: CustomerCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    customer = Customer(
        code=_next_customer_code(db),
        **body.model_dump(),
    )
    db.add(customer)
    db.flush()
    add_audit(db, current_user, "create_customer", "customer", customer.id,
              f"Created: {customer.name} (Code: {customer.code})")
    db.commit()
    db.refresh(customer)
    return _enrich_single_customer(customer, db)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    return _enrich_single_customer(c, db)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    add_audit(db, current_user, "update_customer", "customer", customer_id)
    db.commit()
    db.refresh(c)
    return _enrich_single_customer(c, db)


@router.put("/{customer_id}", response_model=CustomerOut)
def put_customer(
    customer_id: int,
    body: CustomerUpdate,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    return update_customer(customer_id, body, current_user, db)


@router.patch("/{customer_id}/toggle-status", response_model=CustomerOut)
def toggle_customer_status(
    customer_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    c.is_active = not c.is_active
    action = "activate_customer" if c.is_active else "deactivate_customer"
    add_audit(db, current_user, action, "customer", customer_id)
    db.commit()
    db.refresh(c)
    return _enrich_single_customer(c, db)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    c.is_active = False
    add_audit(db, current_user, "deactivate_customer", "customer", customer_id)
    db.commit()


@router.get("/{customer_id}/ledger", response_model=CustomerLedger)
def customer_ledger(
    customer_id: int,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")

    entries: List[CustomerLedgerEntry] = []

    # Opening balance as first entry
    op_balance = Decimal(str(c.opening_balance or 0))
    entries.append(CustomerLedgerEntry(
        id=0,
        date=c.created_at.date() if c.created_at else date(2000, 1, 1),
        type="opening",
        reference="OPENING",
        description="Opening Balance",
        debit=op_balance if op_balance > ZERO else ZERO,
        credit=(-op_balance) if op_balance < ZERO else ZERO,
        balance=ZERO,
    ))

    # Invoices
    inv_q = db.query(Invoice).filter(
        Invoice.customer_id == customer_id,
        Invoice.status != InvoiceStatus.cancelled,
    )
    if date_from:
        inv_q = inv_q.filter(Invoice.invoice_date >= date_from)
    if date_to:
        inv_q = inv_q.filter(Invoice.invoice_date <= date_to)

    for inv in inv_q.order_by(Invoice.invoice_date, Invoice.id).all():
        entries.append(CustomerLedgerEntry(
            id=inv.id,
            date=inv.invoice_date,
            type="invoice",
            reference=inv.invoice_number,
            description=f"Invoice #{inv.invoice_number}",
            debit=inv.total_amount,
            credit=ZERO,
            balance=ZERO,
        ))

    # Payments
    pay_q = db.query(Payment).filter(Payment.customer_id == customer_id)
    if date_from:
        pay_q = pay_q.filter(Payment.payment_date >= date_from)
    if date_to:
        pay_q = pay_q.filter(Payment.payment_date <= date_to)

    for pay in pay_q.order_by(Payment.payment_date, Payment.id).all():
        mode_str = pay.mode.value.upper() if hasattr(pay.mode, "value") else str(pay.mode).upper()
        ref_text = f" (Ref: {pay.reference})" if pay.reference else ""
        entries.append(CustomerLedgerEntry(
            id=pay.id,
            date=pay.payment_date,
            type="payment",
            reference=pay.receipt_number,
            description=f"Payment – {mode_str}{ref_text}",
            debit=ZERO,
            credit=pay.amount,
            balance=ZERO,
        ))

    # Adjustments
    adj_q = db.query(CreditAdjustment).filter(
        CreditAdjustment.customer_id == customer_id
    )
    if date_from:
        adj_q = adj_q.filter(CreditAdjustment.adj_date >= date_from)
    if date_to:
        adj_q = adj_q.filter(CreditAdjustment.adj_date <= date_to)

    for adj in adj_q.order_by(CreditAdjustment.adj_date, CreditAdjustment.id).all():
        is_debit = adj.adj_type == AdjustmentType.debit
        adj_type_str = "Debit Note" if is_debit else "Credit Note"
        entries.append(CustomerLedgerEntry(
            id=adj.id,
            date=adj.adj_date,
            type="adjustment",
            reference=adj.adj_number,
            description=f"{adj_type_str} – {adj.reason or 'Adjustment'}",
            debit=adj.amount if is_debit else ZERO,
            credit=adj.amount if not is_debit else ZERO,
            balance=ZERO,
        ))

    # Sort and compute running balance
    # Keep opening first, then sort chronologically by date
    entries.sort(key=lambda e: (0 if e.type == "opening" else 1, e.date, 0 if e.type == "invoice" else 1))
    running = ZERO
    for e in entries:
        running = running + e.debit - e.credit
        e.balance = running

    total_debit = sum((e.debit for e in entries if e.type != "opening"), ZERO)
    total_credit = sum((e.credit for e in entries if e.type != "opening"), ZERO)

    cust_out = _enrich_single_customer(c, db)

    return CustomerLedger(
        customer=cust_out,
        customer_name=c.name,
        opening_balance=op_balance,
        entries=entries,
        total_debit=total_debit,
        total_credit=total_credit,
        total_debits=total_debit,
        total_credits=total_credit,
        closing_balance=running,
        current_balance=running,
    )


@router.get("/{customer_id}/balance")
def customer_balance(
    customer_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    """Quick balance lookup (opening + invoices - payments - credits)."""
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")

    enriched = _enrich_single_customer(c, db)

    inv_total = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(
        Invoice.customer_id == customer_id,
        Invoice.status != InvoiceStatus.cancelled,
    ).scalar()

    pay_total = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.customer_id == customer_id
    ).scalar()

    credit_adj = db.query(func.coalesce(func.sum(CreditAdjustment.amount), 0)).filter(
        CreditAdjustment.customer_id == customer_id,
        CreditAdjustment.adj_type == AdjustmentType.credit,
    ).scalar()

    debit_adj = db.query(func.coalesce(func.sum(CreditAdjustment.amount), 0)).filter(
        CreditAdjustment.customer_id == customer_id,
        CreditAdjustment.adj_type == AdjustmentType.debit,
    ).scalar()

    return {
        "customer_id": customer_id,
        "customer_name": c.name,
        "customer_code": c.code,
        "opening_balance": c.opening_balance,
        "total_invoiced": inv_total,
        "total_paid": pay_total,
        "credit_adjustments": credit_adj,
        "debit_adjustments": debit_adj,
        "total_debits": enriched.total_debits,
        "total_credits": enriched.total_credits,
        "current_balance": enriched.current_balance,
    }
