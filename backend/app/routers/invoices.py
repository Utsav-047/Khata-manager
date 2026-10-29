"""
Invoices router.
All financial calculations happen inside a DB transaction with Decimal precision.
"""
from decimal import Decimal
from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models import Invoice, InvoiceItem, Customer, Product, InvoiceStatus, PaymentAllocation
from app.schemas import InvoiceCreate, InvoiceOut, InvoiceListOut, InvoiceItemOut, CustomerOut
from app.dependencies import CurrentUser, add_audit

router = APIRouter(prefix="/invoices", tags=["invoices"])

ZERO = Decimal("0.00")


def _next_invoice_number(db: Session) -> str:
    count = db.query(func.count(Invoice.id)).scalar() or 0
    return f"INV-{count + 1:06d}"


def _compute_item_total(item) -> Decimal:
    """line_total = qty * unit_price * (1 - discount_pct/100) with tax."""
    qty = Decimal(str(item.quantity))
    price = Decimal(str(item.unit_price))
    disc = Decimal(str(item.discount_pct or 0)) / 100
    tax = Decimal(str(item.tax_rate or 0)) / 100
    base = qty * price * (1 - disc)
    return (base * (1 + tax)).quantize(Decimal("0.01"))


@router.get("", response_model=List[InvoiceListOut])
def list_invoices(
    *,
    customer_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    query = (
        db.query(
            Invoice,
            Customer.name.label("customer_name"),
            Customer.code.label("customer_code"),
            func.count(InvoiceItem.id).label("items_count"),
        )
        .join(Customer, Invoice.customer_id == Customer.id)
        .outerjoin(InvoiceItem, InvoiceItem.invoice_id == Invoice.id)
        .group_by(Invoice.id, Customer.name, Customer.code)
    )

    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)

    if q:
        query = query.filter(
            Invoice.invoice_number.ilike(f"%{q}%")
            | Customer.name.ilike(f"%{q}%")
            | Customer.code.ilike(f"%{q}%")
        )

    if status_filter and status_filter.lower() != "all":
        sf = status_filter.upper()
        if sf == "POSTED" or status_filter.lower() == "active":
            query = query.filter(Invoice.status != InvoiceStatus.cancelled)
        elif sf == "REVERSED" or status_filter.lower() == "cancelled":
            query = query.filter(Invoice.status == InvoiceStatus.cancelled)
        elif status_filter.lower() in ("unpaid", "due"):
            query = query.filter(Invoice.status.in_([InvoiceStatus.issued, InvoiceStatus.partial]))
        elif status_filter.lower() == "paid":
            query = query.filter(Invoice.status == InvoiceStatus.paid)
        elif status_filter.lower() == "partial":
            query = query.filter(Invoice.status == InvoiceStatus.partial)
        elif status_filter.lower() == "issued":
            query = query.filter(Invoice.status == InvoiceStatus.issued)
        else:
            query = query.filter(Invoice.status == status_filter)

    if date_from:
        query = query.filter(Invoice.invoice_date >= date_from)
    if date_to:
        query = query.filter(Invoice.invoice_date <= date_to)

    rows = query.order_by(Invoice.invoice_date.desc(), Invoice.id.desc()).all()
    result = []
    for inv, cname, ccode, icount in rows:
        out = InvoiceListOut.model_validate(inv)
        out.customer_name = cname
        out.customer_code = ccode
        out.items_count = icount or 0
        result.append(out)
    return result


@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(
    body: InvoiceCreate,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    customer = db.get(Customer, body.customer_id)
    if not customer or not customer.is_active:
        raise HTTPException(404, "Customer not found or inactive")

    invoice = Invoice(
        invoice_number=_next_invoice_number(db),
        customer_id=body.customer_id,
        created_by_id=current_user.id,
        invoice_date=body.invoice_date,
        due_date=body.due_date,
        discount_amount=Decimal(str(body.discount_amount or 0)),
        notes=body.notes,
        status=InvoiceStatus.issued,
    )
    db.add(invoice)
    db.flush()  # get invoice.id

    subtotal = ZERO
    item_tax_total = ZERO

    for item_data in body.items:
        qty = Decimal(str(item_data.quantity))
        price = Decimal(str(item_data.unit_price))
        disc = Decimal(str(item_data.discount_pct or 0)) / 100
        tax = Decimal(str(item_data.tax_rate or 0)) / 100
        base = qty * price * (1 - disc)
        tax_amt = base * tax
        line = (base + tax_amt).quantize(Decimal("0.01"))

        # Resolve description from product if generic or missing
        desc = (item_data.description or "").strip()
        prod = None
        if item_data.product_id:
            prod = db.get(Product, item_data.product_id)
            if prod:
                if not desc or desc.startswith("Item #"):
                    desc = prod.name
                # Deduct inventory stock
                prod.current_stock = (prod.current_stock - qty).quantize(Decimal("0.001"))
                add_audit(
                    db, current_user, "stock_deduct", "product", prod.id,
                    f"Deducted {qty} {prod.unit} for invoice {invoice.invoice_number}. Remaining: {prod.current_stock}"
                )

        if not desc:
            desc = "Item"

        item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=item_data.product_id,
            description=desc,
            quantity=qty,
            unit_price=price,
            discount_pct=Decimal(str(item_data.discount_pct or 0)),
            tax_rate=Decimal(str(item_data.tax_rate or 0)),
            line_total=line,
        )
        db.add(item)
        subtotal += base
        item_tax_total += tax_amt

    # Additional charges or tax amount
    extra_charges = Decimal(str(body.additional_charges or body.tax_amount or 0))
    total_tax = (item_tax_total + extra_charges).quantize(Decimal("0.01"))

    invoice.subtotal = subtotal.quantize(Decimal("0.01"))
    invoice.tax_amount = total_tax
    invoice.discount_amount = Decimal(str(body.discount_amount or 0)).quantize(Decimal("0.01"))
    invoice.total_amount = max(
        ZERO,
        (subtotal + total_tax - invoice.discount_amount).quantize(Decimal("0.01"))
    )
    invoice.balance_due = invoice.total_amount
    invoice.amount_paid = ZERO

    add_audit(db, current_user, "create_invoice", "invoice", invoice.id,
              f"Invoice {invoice.invoice_number} for {customer.name} total ₹{invoice.total_amount}")
    db.commit()
    db.refresh(invoice)
    return get_invoice(invoice.id, current_user, db)


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    inv = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.items).joinedload(InvoiceItem.product),
            joinedload(Invoice.customer),
            joinedload(Invoice.payment_allocations).joinedload(PaymentAllocation.payment),
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not inv:
        raise HTTPException(404, "Invoice not found")

    out = InvoiceOut.model_validate(inv)
    if inv.customer:
        out.customer = CustomerOut.model_validate(inv.customer)

    # Attach item product metadata snapshots
    items_out = []
    for item in inv.items:
        it_out = InvoiceItemOut.model_validate(item)
        if item.product:
            it_out.product_name = item.product.name
            it_out.product_code = item.product.code
            it_out.unit = item.product.unit
        items_out.append(it_out)
    out.items = items_out

    # Attach allocations
    allocs = []
    for pa in inv.payment_allocations:
        pay = pa.payment
        allocs.append({
            "paymentId": str(pa.payment_id),
            "receiptNumber": pay.receipt_number if pay else f"RCP-{pa.payment_id}",
            "paymentDate": str(pay.payment_date) if pay else "",
            "paymentMethod": pay.mode.value.upper() if pay else "CASH",
            "allocatedAmountRupees": float(pa.allocated_amount),
        })
    out.allocations = allocs

    return out


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_invoice(
    invoice_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db)
):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv.amount_paid > ZERO:
        raise HTTPException(400, "Cannot cancel an invoice with recorded payments")
    inv.status = InvoiceStatus.cancelled
    inv.balance_due = ZERO

    # Restore stock for line items linked to catalog products
    for item in inv.items:
        if item.product_id:
            prod = db.get(Product, item.product_id)
            if prod:
                prod.current_stock = (prod.current_stock + item.quantity).quantize(Decimal("0.001"))
                add_audit(
                    db, current_user, "stock_restore", "product", prod.id,
                    f"Restored {item.quantity} {prod.unit} from cancelled invoice {inv.invoice_number}. New stock: {prod.current_stock}"
                )

    add_audit(db, current_user, "cancel_invoice", "invoice", invoice_id,
              f"Invoice {inv.invoice_number} cancelled")
    db.commit()
