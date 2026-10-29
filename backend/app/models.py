"""
SQLAlchemy 2.x ORM Models – Khata Management System
All monetary columns use DECIMAL(15,2) to avoid floating-point errors.
All tables use InnoDB engine with proper foreign keys and indexes.
"""
import enum
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    DECIMAL, Enum, ForeignKey, Index, CheckConstraint,
    func, UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base


# ─── Enums ───────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    staff = "staff"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    partial = "partial"
    paid = "paid"
    cancelled = "cancelled"


class PaymentMode(str, enum.Enum):
    cash = "cash"
    bank_transfer = "bank_transfer"
    upi = "upi"
    cheque = "cheque"
    other = "other"


class AdjustmentType(str, enum.Enum):
    credit = "credit"   # reduce balance (discount / write-off)
    debit = "debit"     # increase balance (return / charge)


# ─── Users ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(200), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.staff)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    audit_logs = relationship("AuditLog", back_populates="user",
                              foreign_keys="AuditLog.user_id")

    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}


# ─── Customers ───────────────────────────────────────────────────────────────

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    credit_limit = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    opening_balance = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    invoices = relationship("Invoice", back_populates="customer")
    payments = relationship("Payment", back_populates="customer")
    adjustments = relationship("CreditAdjustment", back_populates="customer")

    __table_args__ = (
        Index("ix_customers_name_phone", "name", "phone"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )


# ─── Products ────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    unit = Column(String(30), nullable=False, default="pcs")
    unit_price = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=Decimal("0.00"))
    current_stock = Column(DECIMAL(15, 3), nullable=False, default=Decimal("0.000"))
    min_stock_alert = Column(DECIMAL(15, 3), nullable=False, default=Decimal("10.000"))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    invoice_items = relationship("InvoiceItem", back_populates="product")

    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}


# ─── Invoices ────────────────────────────────────────────────────────────────

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String(30), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                            nullable=True)
    invoice_date = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date, nullable=True)
    status = Column(Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.issued)

    subtotal = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    tax_amount = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    total_amount = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    amount_paid = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    balance_due = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    customer = relationship("Customer", back_populates="invoices")
    created_by = relationship("User", foreign_keys=[created_by_id])
    items = relationship("InvoiceItem", back_populates="invoice",
                         cascade="all, delete-orphan")
    payment_allocations = relationship("PaymentAllocation", back_populates="invoice")

    __table_args__ = (
        Index("ix_invoices_customer_status", "customer_id", "status"),
        Index("ix_invoices_date", "invoice_date"),
        CheckConstraint("balance_due >= 0", name="ck_invoice_balance_nonneg"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"),
                        nullable=True)
    description = Column(String(255), nullable=False)
    quantity = Column(DECIMAL(15, 3), nullable=False, default=Decimal("1.000"))
    unit_price = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))
    discount_pct = Column(DECIMAL(5, 2), nullable=False, default=Decimal("0.00"))
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=Decimal("0.00"))
    line_total = Column(DECIMAL(15, 2), nullable=False, default=Decimal("0.00"))

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", back_populates="invoice_items")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_item_qty_positive"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )


# ─── Payments ────────────────────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_number = Column(String(30), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    received_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                             nullable=True)
    payment_date = Column(Date, nullable=False, default=date.today)
    amount = Column(DECIMAL(15, 2), nullable=False)
    mode = Column(Enum(PaymentMode), nullable=False, default=PaymentMode.cash)
    reference = Column(String(100), nullable=True)   # cheque/UPI/bank ref
    notes = Column(Text, nullable=True)
    is_advance = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    customer = relationship("Customer", back_populates="payments")
    received_by = relationship("User", foreign_keys=[received_by_id])
    allocations = relationship("PaymentAllocation", back_populates="payment",
                               cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_payments_customer_date", "customer_id", "payment_date"),
        CheckConstraint("amount > 0", name="ck_payment_positive"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )


class PaymentAllocation(Base):
    """Links a payment to one or more specific invoices (partial-pay support)."""
    __tablename__ = "payment_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="RESTRICT"),
                        nullable=False, index=True)
    allocated_amount = Column(DECIMAL(15, 2), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    payment = relationship("Payment", back_populates="allocations")
    invoice = relationship("Invoice", back_populates="payment_allocations")

    __table_args__ = (
        UniqueConstraint("payment_id", "invoice_id", name="uq_payment_invoice"),
        CheckConstraint("allocated_amount > 0", name="ck_alloc_positive"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )


# ─── Credit Adjustments ──────────────────────────────────────────────────────

class CreditAdjustment(Base):
    """Manual credit/debit note (discount, write-off, return charge, etc.)"""
    __tablename__ = "credit_adjustments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    adj_number = Column(String(30), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"),
                         nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                            nullable=True)
    adj_date = Column(Date, nullable=False, default=date.today)
    adj_type = Column(Enum(AdjustmentType), nullable=False)
    amount = Column(DECIMAL(15, 2), nullable=False)
    reason = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    customer = relationship("Customer", back_populates="adjustments")
    created_by = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_adj_positive"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )


# ─── Audit Logs ──────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                     nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(60), nullable=False)
    resource_id = Column(Integer, nullable=True)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User", back_populates="audit_logs",
                        foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_audit_resource", "resource_type", "resource_id"),
        Index("ix_audit_created", "created_at"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )


# ─── Business Settings ───────────────────────────────────────────────────────

class BusinessSetting(Base):
    __tablename__ = "business_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(),
                        onupdate=func.now())

    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}
