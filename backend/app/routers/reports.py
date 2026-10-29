"""
Reports & analytics router.

Financial reporting follows the central ledger invariant:
customer net balance = opening balance + non-cancelled invoices
                       + debit adjustments - all payments - credit adjustments.
"""
from decimal import Decimal
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models import (
    Customer, Invoice, Payment, PaymentAllocation, InvoiceStatus,
    CreditAdjustment, AdjustmentType, User,
)
from app.schemas import AgingBucket, DashboardStats
from app.dependencies import CurrentUser

router = APIRouter(prefix="/reports", tags=["reports"])
ZERO = Decimal("0.00")


def _customer_balance_rows(db: Session, active_only: bool = True):
    """Return one row per customer with non-duplicated financial aggregates."""
    invoice_totals = (
        db.query(
            Invoice.customer_id.label("customer_id"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("invoiced"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            Invoice.status.in_(
                                [InvoiceStatus.issued, InvoiceStatus.partial]
                            ),
                            Invoice.balance_due,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("invoice_outstanding"),
        )
        .filter(Invoice.status != InvoiceStatus.cancelled)
        .group_by(Invoice.customer_id)
        .subquery()
    )

    payment_totals = (
        db.query(
            Payment.customer_id.label("customer_id"),
            func.coalesce(func.sum(Payment.amount), 0).label("paid"),
        )
        .group_by(Payment.customer_id)
        .subquery()
    )

    adjustment_totals = (
        db.query(
            CreditAdjustment.customer_id.label("customer_id"),
            func.coalesce(
                func.sum(
                    case(
                        (CreditAdjustment.adj_type == AdjustmentType.debit,
                         CreditAdjustment.amount),
                        else_=0,
                    )
                ), 0
            ).label("debit_adjustments"),
            func.coalesce(
                func.sum(
                    case(
                        (CreditAdjustment.adj_type == AdjustmentType.credit,
                         CreditAdjustment.amount),
                        else_=0,
                    )
                ), 0
            ).label("credit_adjustments"),
        )
        .group_by(CreditAdjustment.customer_id)
        .subquery()
    )

    q = (
        db.query(
            Customer.id.label("customer_id"),
            Customer.code.label("customer_code"),
            Customer.name.label("name"),
            Customer.phone.label("phone"),
            Customer.opening_balance.label("opening_balance"),
            func.coalesce(invoice_totals.c.invoiced, 0).label("total_invoiced"),
            func.coalesce(invoice_totals.c.invoice_outstanding, 0).label(
                "invoice_outstanding"
            ),
            func.coalesce(payment_totals.c.paid, 0).label("total_paid"),
            func.coalesce(adjustment_totals.c.debit_adjustments, 0).label(
                "debit_adjustments"
            ),
            func.coalesce(adjustment_totals.c.credit_adjustments, 0).label(
                "credit_adjustments"
            ),
        )
        .outerjoin(invoice_totals, invoice_totals.c.customer_id == Customer.id)
        .outerjoin(payment_totals, payment_totals.c.customer_id == Customer.id)
        .outerjoin(adjustment_totals,
                   adjustment_totals.c.customer_id == Customer.id)
    )
    if active_only:
        q = q.filter(Customer.is_active.is_(True))

    rows = []
    for r in q.all():
        opening = Decimal(str(r.opening_balance or 0))
        invoiced = Decimal(str(r.total_invoiced or 0))
        paid = Decimal(str(r.total_paid or 0))
        debit_adj = Decimal(str(r.debit_adjustments or 0))
        credit_adj = Decimal(str(r.credit_adjustments or 0))
        net = opening + invoiced + debit_adj - paid - credit_adj
        rows.append({
            "customer_id": r.customer_id,
            "customer_code": r.customer_code,
            "name": r.name,
            "phone": r.phone or "",
            "opening_balance": opening,
            "total_invoiced": invoiced,
            "invoice_outstanding": Decimal(str(r.invoice_outstanding or 0)),
            "total_paid": paid,
            "debit_adjustments": debit_adj,
            "credit_adjustments": credit_adj,
            "total_debits": invoiced + debit_adj,
            "total_credits": paid + credit_adj,
            "net_balance": net,
        })
    return rows


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(current_user: CurrentUser, db: Session = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)

    total_customers = db.query(func.count(Customer.id)).scalar() or 0
    active_customers = (
        db.query(func.count(Customer.id))
        .filter(Customer.is_active.is_(True))
        .scalar() or 0
    )
    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0
    pending_invoices = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.status.in_([InvoiceStatus.issued, InvoiceStatus.partial]))
        .scalar() or 0
    )

    # Customer balances breakdown
    balance_rows = _customer_balance_rows(db, active_only=True)
    customers_with_due = sum(1 for r in balance_rows if r["net_balance"] > ZERO)
    settled_count = sum(1 for r in balance_rows if r["net_balance"] == ZERO)
    advance_count = sum(1 for r in balance_rows if r["net_balance"] < ZERO)

    # Total outstanding receivables (sum of balances owed by debtors)
    total_receivable = sum((r["net_balance"] for r in balance_rows if r["net_balance"] > ZERO), ZERO)
    total_opening = sum((r["opening_balance"] for r in balance_rows), ZERO)

    # Sales calculations
    today_sales = (
        db.query(func.coalesce(func.sum(Invoice.total_amount), 0))
        .filter(Invoice.invoice_date == today, Invoice.status != InvoiceStatus.cancelled)
        .scalar() or ZERO
    )
    month_sales = (
        db.query(func.coalesce(func.sum(Invoice.total_amount), 0))
        .filter(
            Invoice.invoice_date >= month_start,
            Invoice.invoice_date <= today,
            Invoice.status != InvoiceStatus.cancelled
        )
        .scalar() or ZERO
    )

    # Collections calculations
    today_collected = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.payment_date == today)
        .scalar() or ZERO
    )
    month_collected = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(
            Payment.payment_date >= month_start,
            Payment.payment_date <= today
        )
        .scalar() or ZERO
    )

    # Overdue invoice amount (due date past or older than 30 days if no due date)
    overdue_amount = (
        db.query(func.coalesce(func.sum(Invoice.balance_due), 0))
        .filter(
            Invoice.status.in_([InvoiceStatus.issued, InvoiceStatus.partial]),
            (
                (Invoice.due_date.isnot(None) & (Invoice.due_date < today))
                | (Invoice.due_date.is_(None) & (Invoice.invoice_date < today))
            ),
        )
        .scalar() or ZERO
    )

    # Top debtors
    debtors = [r for r in balance_rows if r["net_balance"] > ZERO]
    debtors.sort(key=lambda x: x["net_balance"], reverse=True)
    top_customers = [
        {
            "id": r["customer_id"],
            "code": r["customer_code"],
            "name": r["name"],
            "phone": r["phone"],
            "balance": float(r["net_balance"]),
            "baakiRupees": float(r["net_balance"]),
        }
        for r in debtors[:5]
    ]

    return DashboardStats(
        total_customers=total_customers,
        active_customers=active_customers,
        customers_with_balance_due=customers_with_due,
        fully_settled_customers=settled_count,
        customers_with_advance=advance_count,
        total_invoices=total_invoices,
        pending_invoices=pending_invoices,
        total_receivable=Decimal(str(total_receivable)),
        total_opening_balance=Decimal(str(total_opening)),
        today_sales=Decimal(str(today_sales)),
        month_sales=Decimal(str(month_sales)),
        today_collected=Decimal(str(today_collected)),
        month_collected=Decimal(str(month_collected)),
        total_collected_month=Decimal(str(month_collected)),
        overdue_amount=Decimal(str(overdue_amount)),
        top_customers=top_customers,
    )


@router.get("/aging", response_model=List[AgingBucket])
def aging_report(
    *,
    as_of: Optional[date] = Query(None, description="As-of date, defaults to today"),
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    today = as_of or date.today()
    pending = (
        db.query(Invoice)
        .filter(Invoice.status.in_([InvoiceStatus.issued, InvoiceStatus.partial]))
        .all()
    )
    buckets: dict[int, AgingBucket] = {}
    customers = {c.id: c for c in db.query(Customer).all()}

    for inv in pending:
        due = inv.due_date or inv.invoice_date
        days_overdue = (today - due).days
        bal = Decimal(str(inv.balance_due))
        if inv.customer_id not in buckets:
            c = customers.get(inv.customer_id)
            cname = c.name if c else f"Customer #{inv.customer_id}"
            buckets[inv.customer_id] = AgingBucket(
                customer_id=inv.customer_id, customer_name=cname,
                current=ZERO, days_1_30=ZERO, days_31_60=ZERO,
                days_61_90=ZERO, over_90=ZERO, total=ZERO,
            )
        b = buckets[inv.customer_id]
        b.total += bal
        if days_overdue <= 0:
            b.current += bal
        elif days_overdue <= 30:
            b.days_1_30 += bal
        elif days_overdue <= 60:
            b.days_31_60 += bal
        elif days_overdue <= 90:
            b.days_61_90 += bal
        else:
            b.over_90 += bal
    return [b for b in buckets.values() if b.total > ZERO]


@router.get("/collections")
def collections_report(
    *,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    method: Optional[str] = Query(None),
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    today = date.today()
    d_from = date_from or today.replace(day=1)
    d_to = date_to or today

    if d_from > d_to:
        raise HTTPException(status_code=422, detail="date_from must be on or before date_to")

    q = (
        db.query(Payment, Customer.name.label("customer_name"), Customer.phone.label("customer_phone"), User.full_name.label("user_name"))
        .join(Customer, Payment.customer_id == Customer.id)
        .outerjoin(User, Payment.received_by_id == User.id)
        .filter(Payment.payment_date.between(d_from, d_to))
    )

    if method and method.upper() != "ALL":
        q = q.filter(Payment.mode == method.lower())

    payments = q.order_by(Payment.payment_date.desc(), Payment.id.desc()).all()

    breakdown = {
        "cashRupees": 0.0,
        "upiRupees": 0.0,
        "bankTransferRupees": 0.0,
        "chequeRupees": 0.0,
        "otherRupees": 0.0,
    }
    rows = []
    total_amt = Decimal("0.00")

    for pay, cname, cphone, uname in payments:
        amt = float(pay.amount)
        total_amt += Decimal(str(pay.amount))
        mode_val = pay.mode.value if hasattr(pay.mode, "value") else str(pay.mode)

        if mode_val == "cash":
            breakdown["cashRupees"] += amt
        elif mode_val == "upi":
            breakdown["upiRupees"] += amt
        elif mode_val == "bank_transfer":
            breakdown["bankTransferRupees"] += amt
        elif mode_val == "cheque":
            breakdown["chequeRupees"] += amt
        else:
            breakdown["otherRupees"] += amt

        rows.append({
            "receiptNumber": pay.receipt_number,
            "paymentDate": str(pay.payment_date),
            "customerId": str(pay.customer_id),
            "customerName": cname,
            "mobile": cphone or "",
            "paymentMethod": mode_val.upper(),
            "referenceNumber": pay.reference or "",
            "amountRupees": amt,
            "createdBy": uname or "Staff",
        })

    return {
        "rows": rows,
        "breakdownByMethod": breakdown,
        "totalCollectedRupees": float(total_amt),
        "count": len(rows),
    }


@router.get("/outstanding")
def outstanding_report(
    status: Optional[str] = Query(None),
    current_user: CurrentUser = None,
    db: Session = Depends(get_db),
):
    """Customers balance report with complete net accounting balance."""
    rows = _customer_balance_rows(db, active_only=True)

    if status == "with_balance":
        filtered = [r for r in rows if r["net_balance"] > ZERO]
    elif status == "settled":
        filtered = [r for r in rows if r["net_balance"] <= ZERO]
    elif status == "advance":
        filtered = [r for r in rows if r["net_balance"] < ZERO]
    else:
        # Default or "all"
        filtered = rows

    filtered.sort(key=lambda r: r["net_balance"], reverse=True)

    mapped_rows = [
        {
            "customerId": str(r["customer_id"]),
            "customerCode": r["customer_code"],
            "name": r["name"],
            "mobile": r["phone"],
            "openingBalanceRupees": float(r["opening_balance"]),
            "totalDebitsRupees": float(r["total_debits"]),
            "totalPaymentsRupees": float(r["total_credits"]),
            "total_invoiced": float(r["total_invoiced"]),
            "total_paid": float(r["total_paid"]),
            "outstandingBalanceRupees": float(r["net_balance"]),
            "balance_due": float(r["net_balance"]),
            "isSettled": r["net_balance"] <= ZERO,
        }
        for r in filtered
    ]

    total_outstanding = sum((r["net_balance"] for r in rows if r["net_balance"] > ZERO), ZERO)

    return {
        "rows": mapped_rows,
        "totalCustomers": len(mapped_rows),
        "totalOutstandingRupees": float(total_outstanding),
    }


@router.get("/unallocated")
def unallocated_report(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    """List payments that have unallocated balance remaining."""
    alloc_sub = (
        db.query(
            PaymentAllocation.payment_id.label("payment_id"),
            func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0).label("allocated_total"),
        )
        .group_by(PaymentAllocation.payment_id)
        .subquery()
    )

    q = (
        db.query(
            Payment,
            Customer.name.label("customer_name"),
            Customer.phone.label("customer_phone"),
            func.coalesce(alloc_sub.c.allocated_total, 0).label("allocated_total"),
        )
        .join(Customer, Payment.customer_id == Customer.id)
        .outerjoin(alloc_sub, alloc_sub.c.payment_id == Payment.id)
        .order_by(Payment.payment_date.desc(), Payment.id.desc())
    )

    rows = []
    total_unallocated = ZERO

    for pay, cname, cphone, alloc_tot in q.all():
        allocated = Decimal(str(alloc_tot or 0))
        unallocated = max(ZERO, Decimal(str(pay.amount)) - allocated)
        if unallocated > ZERO:
            total_unallocated += unallocated
            mode_val = pay.mode.value if hasattr(pay.mode, "value") else str(pay.mode)
            rows.append({
                "paymentId": str(pay.id),
                "receiptNumber": pay.receipt_number,
                "paymentDate": str(pay.payment_date),
                "customerId": str(pay.customer_id),
                "customerName": cname,
                "paymentMethod": mode_val.upper(),
                "totalAmountRupees": float(pay.amount),
                "allocatedAmountRupees": float(allocated),
                "unallocatedAmountRupees": float(unallocated),
            })

    return {
        "rows": rows,
        "count": len(rows),
        "totalUnallocatedRupees": float(total_unallocated),
    }
