from __future__ import annotations
import re
"""
Pydantic v2 request/response schemas for all API endpoints.
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator, model_validator, ConfigDict
from pydantic import AliasChoices, Field

from app.models import UserRole, InvoiceStatus, PaymentMode, AdjustmentType


# ─── Shared ──────────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    full_name: str
    role: UserRole


class PasswordChangeRequest(BaseModel):
    # The React client posts camelCase; accept snake_case too for API clients.
    current_password: str = Field(
        validation_alias=AliasChoices("current_password", "currentPassword")
    )
    new_password: str = Field(
        validation_alias=AliasChoices("new_password", "newPassword")
    )

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @model_validator(mode="after")
    def passwords_differ(self):
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from current password")
        return self


class MessageResponse(BaseModel):
    success: bool = True
    message: str


# ─── Users ───────────────────────────────────────────────────────────────────


def validate_phone_number(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    cleaned = re.sub(r"[\s\-\(\)\+]", "", v.strip())
    if cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    if not re.match(r"^[6-9]\d{9}$", cleaned):
        raise ValueError("Invalid mobile number. Must be a valid 10-digit Indian phone number starting with 6, 7, 8, or 9.")
    return cleaned

def validate_email_address(v: Optional[str]) -> Optional[str]:
    if not v or not v.strip():
        return None
    email = v.strip().lower()
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(pattern, email):
        raise ValueError("Invalid email format. Please provide a valid email address (e.g. name@example.com).")
    return email

class UserCreate(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    role: UserRole = UserRole.staff

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_number(v)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: Optional[str]) -> Optional[str]:
        return validate_email_address(v)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_number(v)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: Optional[str]) -> Optional[str]:
        return validate_email_address(v)


class UserOut(OrmBase):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime


# ─── Customers ───────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    credit_limit: Decimal = Decimal("0.00")
    opening_balance: Decimal = Decimal("0.00")
    notes: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_number(v)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: Optional[str]) -> Optional[str]:
        return validate_email_address(v)


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_number(v)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: Optional[str]) -> Optional[str]:
        return validate_email_address(v)


class CustomerOut(OrmBase):
    id: int
    code: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    credit_limit: Decimal = Decimal("0.00")
    opening_balance: Decimal = Decimal("0.00")
    current_balance: Decimal = Decimal("0.00")
    total_debits: Decimal = Decimal("0.00")
    total_credits: Decimal = Decimal("0.00")
    is_active: bool = True
    created_at: datetime


class CustomerLedgerEntry(BaseModel):
    id: Optional[int] = None
    date: date
    type: str          # "invoice" | "payment" | "adjustment" | "opening"
    reference: str
    description: str
    debit: Decimal
    credit: Decimal
    balance: Decimal


class CustomerLedger(BaseModel):
    customer: CustomerOut
    customer_name: Optional[str] = None
    opening_balance: Decimal = Decimal("0.00")
    entries: List[CustomerLedgerEntry]
    total_debit: Decimal = Decimal("0.00")
    total_credit: Decimal = Decimal("0.00")
    total_debits: Decimal = Decimal("0.00")
    total_credits: Decimal = Decimal("0.00")
    closing_balance: Decimal = Decimal("0.00")
    current_balance: Decimal = Decimal("0.00")


# ─── Products ────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    unit: str = "pcs"
    unit_price: Decimal = Decimal("0.00")
    tax_rate: Decimal = Decimal("0.00")
    current_stock: Decimal = Decimal("0.000")
    min_stock_alert: Decimal = Decimal("10.000")


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    current_stock: Optional[Decimal] = None
    min_stock_alert: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ProductOut(OrmBase):
    id: int
    code: str
    name: str
    description: Optional[str]
    unit: str
    unit_price: Decimal
    tax_rate: Decimal
    current_stock: Decimal = Decimal("0.000")
    min_stock_alert: Decimal = Decimal("10.000")
    is_active: bool
    created_at: datetime


# ─── Invoices ────────────────────────────────────────────────────────────────

class InvoiceItemCreate(BaseModel):
    product_id: Optional[int] = None
    description: Optional[str] = ""
    quantity: Decimal = Decimal("1.000")
    unit_price: Decimal = Decimal("0.00")
    discount_pct: Decimal = Decimal("0.00")
    tax_rate: Decimal = Decimal("0.00")


class InvoiceItemOut(OrmBase):
    id: int
    product_id: Optional[int] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal
    tax_rate: Decimal
    line_total: Decimal
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    unit: Optional[str] = None


class InvoiceCreate(BaseModel):
    customer_id: int
    invoice_date: date
    due_date: Optional[date] = None
    discount_amount: Decimal = Decimal("0.00")
    additional_charges: Decimal = Decimal("0.00")
    tax_amount: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    items: List[InvoiceItemCreate]

    @field_validator("items")
    @classmethod
    def must_have_items(cls, v):
        if not v:
            raise ValueError("Invoice must have at least one item")
        return v


class InvoiceOut(OrmBase):
    id: int
    invoice_number: str
    customer_id: int
    invoice_date: date
    due_date: Optional[date]
    status: InvoiceStatus
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    notes: Optional[str]
    created_at: datetime
    customer: Optional[CustomerOut] = None
    items: List[InvoiceItemOut] = []
    allocations: List[dict] = []


class InvoiceListOut(OrmBase):
    id: int
    invoice_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_code: Optional[str] = None
    invoice_date: date
    due_date: Optional[date] = None
    status: InvoiceStatus
    subtotal: Decimal = Decimal("0.00")
    discount_amount: Decimal = Decimal("0.00")
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal = Decimal("0.00")
    amount_paid: Decimal = Decimal("0.00")
    balance_due: Decimal = Decimal("0.00")
    items_count: int = 0
    created_at: datetime


# ─── Payments ────────────────────────────────────────────────────────────────

class AllocationIn(BaseModel):
    invoice_id: int
    allocated_amount: Decimal


class PaymentAllocateRequest(BaseModel):
    """Re-allocate the unallocated remainder of an existing payment."""
    allocations: List[AllocationIn] = []

    @field_validator("allocations")
    @classmethod
    def at_least_one(cls, v):
        if not v:
            raise ValueError("At least one allocation is required")
        return v


class PaymentCreate(BaseModel):
    customer_id: int
    payment_date: date
    amount: Decimal
    mode: PaymentMode = PaymentMode.cash
    reference: Optional[str] = None
    notes: Optional[str] = None
    allocations: List[AllocationIn] = []

    @field_validator("amount")
    @classmethod
    def positive_amount(cls, v):
        if v <= 0:
            raise ValueError("Payment amount must be positive")
        return v


class AllocationOut(OrmBase):
    id: int
    invoice_id: int
    allocated_amount: Decimal


class PaymentOut(OrmBase):
    id: int
    receipt_number: str
    customer_id: int
    payment_date: date
    amount: Decimal
    mode: PaymentMode
    reference: Optional[str] = None
    notes: Optional[str] = None
    is_advance: bool
    allocated_amount: Decimal = Decimal("0.00")
    unallocated_amount: Decimal = Decimal("0.00")
    created_at: datetime
    customer: Optional[CustomerOut] = None
    allocations: List[AllocationOut] = []


class PaymentListOut(OrmBase):
    id: int
    receipt_number: str
    customer_id: int
    customer_name: Optional[str] = None
    customer_code: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_date: date
    amount: Decimal
    allocated_amount: Decimal = Decimal("0.00")
    unallocated_amount: Decimal = Decimal("0.00")
    allocations_count: int = 0
    mode: PaymentMode
    is_advance: bool
    created_at: datetime


# ─── Credit Adjustments ──────────────────────────────────────────────────────

class AdjustmentCreate(BaseModel):
    customer_id: int
    adj_date: date
    adj_type: AdjustmentType
    amount: Decimal
    reason: str
    notes: Optional[str] = None


class AdjustmentOut(OrmBase):
    id: int
    adj_number: str
    customer_id: int
    adj_date: date
    adj_type: AdjustmentType
    amount: Decimal
    reason: str
    notes: Optional[str]
    created_at: datetime


# ─── Reports ─────────────────────────────────────────────────────────────────

class AgingBucket(BaseModel):
    customer_id: int
    customer_name: str
    current: Decimal
    days_1_30: Decimal
    days_31_60: Decimal
    days_61_90: Decimal
    over_90: Decimal
    total: Decimal


class DashboardStats(BaseModel):
    total_customers: int
    active_customers: int
    customers_with_balance_due: int = 0
    fully_settled_customers: int = 0
    customers_with_advance: int = 0
    total_invoices: int
    pending_invoices: int
    total_receivable: Decimal
    total_opening_balance: Decimal = Decimal("0.00")
    today_sales: Decimal = Decimal("0.00")
    month_sales: Decimal = Decimal("0.00")
    today_collected: Decimal = Decimal("0.00")
    month_collected: Decimal = Decimal("0.00")
    total_collected_month: Decimal = Decimal("0.00")
    overdue_amount: Decimal
    top_customers: List[dict]


# ─── Audit Logs ──────────────────────────────────────────────────────────────

class AuditLogOut(OrmBase):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: str
    resource_id: Optional[int]
    detail: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


# ─── Settings ────────────────────────────────────────────────────────────────

class SettingUpdate(BaseModel):
    key: str
    value: Optional[str]


class SettingOut(OrmBase):
    key: str
    value: Optional[str]
    updated_at: datetime


# ─── Pagination ──────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    size: int
    pages: int
