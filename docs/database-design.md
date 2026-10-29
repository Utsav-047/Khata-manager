# Khata Management System - Database Design & Indexes

Database Engine: **MariaDB / MySQL (or SQLite in tests)** with SQLAlchemy 2.0 ORM and Alembic migrations.

---

## Tables & Relations

### 1. `users`
- `id`: Integer (PK, autoincrement)
- `username`: VARCHAR(80) (Unique, Index)
- `full_name`: VARCHAR(150)
- `email`: VARCHAR(200) (Unique, nullable)
- `hashed_password`: VARCHAR(255)
- `role`: Enum ('admin', 'manager', 'staff')
- `is_active`: Boolean
- `created_at`: DateTime
- `updated_at`: DateTime

### 2. `customers`
- `id`: Integer (PK, autoincrement)
- `customer_code`: VARCHAR(30) (Unique, Index)
- `name`: VARCHAR(150) (Index)
- `phone`: VARCHAR(20) (Index, nullable)
- `email`: VARCHAR(150) (nullable)
- `address`: Text (nullable)
- `notes`: Text (nullable)
- `credit_limit`: DECIMAL(15, 2)
- `opening_balance`: DECIMAL(15, 2)
- `is_active`: Boolean (Index)
- `created_at`: DateTime
- `updated_at`: DateTime

### 3. `products`
- `id`: Integer (PK, autoincrement)
- `product_code`: VARCHAR(30) (Unique, Index)
- `name`: VARCHAR(150) (Index)
- `description`: Text (nullable)
- `unit`: VARCHAR(30) ('Bags', 'Kg', 'Liters', etc.)
- `unit_price`: DECIMAL(15, 2)
- `cost_price`: DECIMAL(15, 2)
- `stock_quantity`: DECIMAL(12, 3)
- `is_active`: Boolean (Index)
- `created_at`: DateTime
- `updated_at`: DateTime

### 4. `invoices`
- `id`: Integer (PK, autoincrement)
- `invoice_number`: VARCHAR(50) (Unique, Index)
- `customer_id`: Integer (FK: `customers.id`, Index)
- `created_by_id`: Integer (FK: `users.id`, Index)
- `invoice_date`: Date (Index)
- `due_date`: Date (nullable)
- `subtotal`: DECIMAL(15, 2)
- `discount_amount`: DECIMAL(15, 2)
- `tax_amount`: DECIMAL(15, 2)
- `total_amount`: DECIMAL(15, 2)
- `status`: Enum ('draft', 'issued', 'partial', 'paid', 'cancelled')
- `notes`: Text (nullable)
- `created_at`: DateTime
- `updated_at`: DateTime

### 5. `invoice_items`
- `id`: Integer (PK, autoincrement)
- `invoice_id`: Integer (FK: `invoices.id`, Index)
- `product_id`: Integer (FK: `products.id`, nullable)
- `product_name_snap`: VARCHAR(150)
- `product_code_snap`: VARCHAR(30)
- `unit_snap`: VARCHAR(30)
- `quantity`: DECIMAL(12, 3)
- `unit_price`: DECIMAL(15, 2)
- `line_total`: DECIMAL(15, 2)

### 6. `payments`
- `id`: Integer (PK, autoincrement)
- `receipt_number`: VARCHAR(50) (Unique, Index)
- `customer_id`: Integer (FK: `customers.id`, Index)
- `recorded_by_id`: Integer (FK: `users.id`, Index)
- `payment_date`: Date (Index)
- `amount`: DECIMAL(15, 2)
- `payment_mode`: Enum ('cash', 'bank_transfer', 'upi', 'cheque', 'other')
- `reference_note`: String(200) (nullable)
- `notes`: Text (nullable)
- `created_at`: DateTime

### 7. `payment_allocations`
- `id`: Integer (PK, autoincrement)
- `payment_id`: Integer (FK: `payments.id`, Index)
- `invoice_id`: Integer (FK: `invoices.id`, Index)
- `amount`: DECIMAL(15, 2)
- `created_at`: DateTime

### 8. `adjustments`
- `id`: Integer (PK, autoincrement)
- `customer_id`: Integer (FK: `customers.id`, Index)
- `recorded_by_id`: Integer (FK: `users.id`, Index)
- `adjustment_type`: Enum ('credit', 'debit')
- `amount`: DECIMAL(15, 2)
- `reason`: Text
- `adjustment_date`: Date (Index)
- `created_at`: DateTime

### 9. `audit_logs`
- `id`: Integer (PK, autoincrement)
- `user_id`: Integer (FK: `users.id`, nullable)
- `username_snap`: VARCHAR(80) (nullable)
- `action`: VARCHAR(50) (Index)
- `entity_name`: VARCHAR(50) (Index)
- `entity_id`: Integer (Index, nullable)
- `old_values`: Text (JSON string)
- `new_values`: Text (JSON string)
- `ip_address`: VARCHAR(45) (nullable)
- `timestamp`: DateTime (Index)

### 10. `business_settings`
- `id`: Integer (PK, autoincrement)
- `key`: VARCHAR(100) (Unique, Index)
- `value`: Text
