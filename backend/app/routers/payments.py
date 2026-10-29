"""
Payments router.
Supports:
  - Simple payment / unallocated credit
  - Invoice-specific allocation with partial-pay tracking
All invoice balance updates run inside a DB transaction with Decimal precision.
"""
from decimal import Decimal
from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models import Invoice, Payment, PaymentAllocation, Customer, InvoiceStatus
from app.schemas import (
    PaymentCreate, PaymentAllocateRequest, PaymentOut,
    PaymentListOut, CustomerOut, AllocationOut
)
from app.dependencies import CurrentUser, add_audit

router = APIRouter(prefix="/payments", tags=["payments"])

ZERO = Decimal("0.00")


def _next_receipt_number(db: Session) -> str:
    count = db.query(func.count(Payment.id)).scalar() or 0
    return f"RCP-{count + 1:06d}"


def _sync_invoice_status(invoice: Invoice):
    """Update invoice status and balance_due after payment change."""
    invoice.balance_due = max(ZERO, invoice.total_amount - invoice.amount_paid)
    if invoice.amount_paid >= invoice.total_amount:
        invoice.status = InvoiceStatus.paid
    elif invoice.amount_paid > ZERO:
        invoice.status = InvoiceStatus.partial
    else:
        invoice.status = InvoiceStatus.issued


@router.get("", response_model=List[PaymentListOut])
def list_payments(
    *,
    customer_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    alloc_sub = (
        db.query(
            PaymentAllocation.payment_id.label("payment_id"),
            func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0).label("allocated_total"),
            func.count(PaymentAllocation.id).label("alloc_count"),
        )
        .group_by(PaymentAllocation.payment_id)
        .subquery()
    )

    query = (
        db.query(
            Payment,
            Customer.name.label("customer_name"),
            Customer.code.label("customer_code"),
            Customer.phone.label("customer_phone"),
            func.coalesce(alloc_sub.c.allocated_total, 0).label("allocated_total"),
            func.coalesce(alloc_sub.c.alloc_count, 0).label("alloc_count"),
        )
        .join(Customer, Payment.customer_id == Customer.id)
        .outerjoin(alloc_sub, alloc_sub.c.payment_id == Payment.id)
    )

    if customer_id:
        query = query.filter(Payment.customer_id == customer_id)

    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            Payment.receipt_number.ilike(search_pattern)
            | Customer.name.ilike(search_pattern)
            | Customer.code.ilike(search_pattern)
            | Payment.reference.ilike(search_pattern)
        )

    if date_from:
        query = query.filter(Payment.payment_date >= date_from)
    if date_to:
        query = query.filter(Payment.payment_date <= date_to)

    rows = query.order_by(Payment.payment_date.desc(), Payment.id.desc()).all()
    result = []
    for pay, cname, ccode, cphone, alloc_tot, alloc_cnt in rows:
        out = PaymentListOut.model_validate(pay)
        out.customer_name = cname
        out.customer_code = ccode
        out.customer_phone = cphone
        out.allocated_amount = Decimal(str(alloc_tot or 0))
        out.unallocated_amount = max(ZERO, Decimal(str(pay.amount)) - out.allocated_amount)
        out.allocations_count = alloc_cnt or 0
        result.append(out)
    return result


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def record_payment(
    body: PaymentCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    customer = db.get(Customer, body.customer_id)
    if not customer or not customer.is_active:
        raise HTTPException(404, "Customer not found or inactive")

    # Validate allocations if provided
    allocated_sum = ZERO
    for alloc in body.allocations:
        inv = db.get(Invoice, alloc.invoice_id)
        if not inv:
            raise HTTPException(404, f"Invoice {alloc.invoice_id} not found")
        if inv.customer_id != body.customer_id:
            raise HTTPException(
                400, f"Invoice {alloc.invoice_id} does not belong to customer {customer.name}"
            )
        if inv.status == InvoiceStatus.cancelled:
            raise HTTPException(400, f"Invoice {alloc.invoice_id} is cancelled")
        alloc_amt = Decimal(str(alloc.allocated_amount))
        if alloc_amt > inv.balance_due:
            raise HTTPException(
                400,
                f"Allocation ₹{alloc_amt} exceeds balance ₹{inv.balance_due} "
                f"on invoice {inv.invoice_number}",
            )
        allocated_sum += alloc_amt

    if body.allocations and allocated_sum > body.amount:
        raise HTTPException(
            400,
            f"Total allocations ₹{allocated_sum} exceed payment ₹{body.amount}"
        )

    is_advance = not body.allocations or allocated_sum < body.amount

    payment = Payment(
        receipt_number=_next_receipt_number(db),
        customer_id=body.customer_id,
        received_by_id=current_user.id,
        payment_date=body.payment_date,
        amount=body.amount,
        mode=body.mode,
        reference=body.reference,
        notes=body.notes,
        is_advance=is_advance,
    )
    db.add(payment)
    db.flush()

    # Apply allocations
    for alloc in body.allocations:
        inv = db.get(Invoice, alloc.invoice_id)
        alloc_amt = Decimal(str(alloc.allocated_amount))

        pa = PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=alloc_amt,
        )
        db.add(pa)

        inv.amount_paid = Decimal(str(inv.amount_paid)) + alloc_amt
        _sync_invoice_status(inv)

    mode_label = body.mode.value if hasattr(body.mode, "value") else str(body.mode)
    add_audit(db, current_user, "record_payment", "payment", payment.id,
              f"Received ₹{body.amount} from {customer.name} via {mode_label}")
    db.commit()
    db.refresh(payment)
    return get_payment(payment.id, current_user, db)


@router.post("/{payment_id}/allocate", response_model=PaymentOut)
def allocate_payment(
    payment_id: int,
    body: PaymentAllocateRequest,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    """Spread an existing payment's unallocated remainder across invoices."""
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")

    already = sum(
        (Decimal(str(a.allocated_amount)) for a in payment.allocations), ZERO
    )
    remaining = Decimal(str(payment.amount)) - already
    if remaining <= ZERO:
        raise HTTPException(400, "Payment is already fully allocated")

    new_sum = ZERO
    for alloc in body.allocations:
        inv = db.get(Invoice, alloc.invoice_id)
        if not inv:
            raise HTTPException(404, f"Invoice {alloc.invoice_id} not found")
        if inv.customer_id != payment.customer_id:
            raise HTTPException(
                400, f"Invoice {alloc.invoice_id} does not belong to this customer"
            )
        if inv.status == InvoiceStatus.cancelled:
            raise HTTPException(400, f"Invoice {alloc.invoice_id} is cancelled")
        alloc_amt = Decimal(str(alloc.allocated_amount))
        if alloc_amt <= ZERO:
            raise HTTPException(400, "Allocation amount must be positive")
        if alloc_amt > inv.balance_due:
            raise HTTPException(
                400,
                f"Allocation ₹{alloc_amt} exceeds balance ₹{inv.balance_due} "
                f"on invoice {inv.invoice_number}",
            )
        new_sum += alloc_amt

    if new_sum > remaining:
        raise HTTPException(
            400,
            f"Total allocations ₹{new_sum} exceed unallocated "
            f"₹{remaining} on receipt {payment.receipt_number}",
        )

    for alloc in body.allocations:
        inv = db.get(Invoice, alloc.invoice_id)
        alloc_amt = Decimal(str(alloc.allocated_amount))
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=alloc_amt,
        ))
        inv.amount_paid = Decimal(str(inv.amount_paid)) + alloc_amt
        _sync_invoice_status(inv)

    payment.is_advance = (already + new_sum) < Decimal(str(payment.amount))
    add_audit(db, current_user, "allocate_payment", "payment", payment.id,
              f"Allocated ₹{new_sum} of ₹{remaining} on receipt {payment.receipt_number}")
    db.commit()
    db.refresh(payment)
    return get_payment(payment.id, current_user, db)


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    p = (
        db.query(Payment)
        .options(
            joinedload(Payment.customer),
            joinedload(Payment.allocations).joinedload(PaymentAllocation.invoice),
        )
        .filter(Payment.id == payment_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "Payment not found")

    out = PaymentOut.model_validate(p)
    if p.customer:
        out.customer = CustomerOut.model_validate(p.customer)

    allocated_sum = sum((Decimal(str(a.allocated_amount)) for a in p.allocations), ZERO)
    out.allocated_amount = allocated_sum
    out.unallocated_amount = max(ZERO, Decimal(str(p.amount)) - allocated_sum)
    out.allocations = [AllocationOut.model_validate(a) for a in p.allocations]
    return out


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(
    payment_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    """Reverse a payment: undo all invoice allocations atomically."""
    p = db.get(Payment, payment_id)
    if not p:
        raise HTTPException(404, "Payment not found")

    # Reverse all allocations
    for alloc in p.allocations:
        inv = db.get(Invoice, alloc.invoice_id)
        if inv:
            inv.amount_paid = max(
                ZERO,
                Decimal(str(inv.amount_paid)) - Decimal(str(alloc.allocated_amount))
            )
            _sync_invoice_status(inv)

    add_audit(db, current_user, "delete_payment", "payment", payment_id,
              f"Reversed receipt {p.receipt_number}")
    db.delete(p)
    db.commit()
