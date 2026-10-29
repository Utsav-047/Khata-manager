"""Tests: invoice + payment + ledger integration."""
from datetime import date


def _setup_customer_and_product(client, auth_headers):
    """Helper: create a customer and product if none exist."""
    r = client.get("/api/v1/customers", headers=auth_headers)
    customers = r.json()
    if not customers:
        client.post("/api/v1/customers", headers=auth_headers, json={
            "name": "Suresh Bhai",
            "phone": "9988776655",
            "opening_balance": "0.00",
        })
        r = client.get("/api/v1/customers", headers=auth_headers)
        customers = r.json()
    cust_id = customers[0]["id"]

    r = client.get("/api/v1/products", headers=auth_headers)
    products = r.json()
    if not products:
        client.post("/api/v1/products", headers=auth_headers, json={
            "name": "Rice 25kg",
            "unit": "bag",
            "unit_price": "1200.00",
            "tax_rate": "0.00",
        })
        r = client.get("/api/v1/products", headers=auth_headers)
        products = r.json()
    prod_id = products[0]["id"]
    return cust_id, prod_id


def test_create_invoice(client, auth_headers):
    cust_id, prod_id = _setup_customer_and_product(client, auth_headers)
    r = client.post("/api/v1/invoices", headers=auth_headers, json={
        "customer_id": cust_id,
        "invoice_date": str(date.today()),
        "discount_amount": "50.00",
        "items": [
            {
                "product_id": prod_id,
                "description": "Rice 25kg bag",
                "quantity": "2.000",
                "unit_price": "1200.00",
                "discount_pct": "0.00",
                "tax_rate": "0.00",
            }
        ],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["invoice_number"].startswith("INV-")
    assert float(data["total_amount"]) == 2350.00  # 2*1200 - 50
    assert float(data["balance_due"]) == 2350.00
    assert data["status"] == "issued"


def test_list_invoices(client, auth_headers):
    r = client.get("/api/v1/invoices", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_get_invoice(client, auth_headers):
    r = client.get("/api/v1/invoices", headers=auth_headers)
    inv_id = r.json()[0]["id"]
    r2 = client.get(f"/api/v1/invoices/{inv_id}", headers=auth_headers)
    assert r2.status_code == 200
    assert "items" in r2.json()


def test_record_payment_with_allocation(client, auth_headers):
    """Pay ₹1000 against the first invoice."""
    invoices = client.get("/api/v1/invoices", headers=auth_headers).json()
    inv = invoices[0]

    r = client.post("/api/v1/payments", headers=auth_headers, json={
        "customer_id": inv["customer_id"],
        "payment_date": str(date.today()),
        "amount": "1000.00",
        "mode": "cash",
        "allocations": [
            {"invoice_id": inv["id"], "allocated_amount": "1000.00"}
        ],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["receipt_number"].startswith("RCP-")
    assert float(data["amount"]) == 1000.00
    assert len(data["allocations"]) == 1

    # Verify invoice updated
    r2 = client.get(f"/api/v1/invoices/{inv['id']}", headers=auth_headers)
    inv2 = r2.json()
    assert float(inv2["amount_paid"]) == 1000.00
    assert inv2["status"] == "partial"


def test_record_advance_payment(client, auth_headers):
    """Advance payment with no allocation."""
    customers = client.get("/api/v1/customers", headers=auth_headers).json()
    cust_id = customers[0]["id"]

    r = client.post("/api/v1/payments", headers=auth_headers, json={
        "customer_id": cust_id,
        "payment_date": str(date.today()),
        "amount": "500.00",
        "mode": "upi",
        "reference": "UPI-REF-12345",
    })
    assert r.status_code == 201
    assert r.json()["is_advance"] == True


def test_list_payments(client, auth_headers):
    r = client.get("/api/v1/payments", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 2


def test_overallocation_rejected(client, auth_headers):
    """Allocating more than balance_due must fail."""
    invoices = client.get("/api/v1/invoices", headers=auth_headers).json()
    inv = invoices[0]
    customers = client.get("/api/v1/customers", headers=auth_headers).json()
    cust_id = customers[0]["id"]

    r = client.post("/api/v1/payments", headers=auth_headers, json={
        "customer_id": cust_id,
        "payment_date": str(date.today()),
        "amount": "999999.00",
        "mode": "cash",
        "allocations": [
            {"invoice_id": inv["id"], "allocated_amount": "999999.00"}
        ],
    })
    assert r.status_code == 400


def test_dashboard(client, auth_headers):
    r = client.get("/api/v1/reports/dashboard", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert "total_customers" in d
    assert "total_receivable" in d
    assert "top_customers" in d
    assert "today_sales" in d
    assert "today_collected" in d
    assert "customers_with_balance_due" in d
    assert "fully_settled_customers" in d


def test_aging_report(client, auth_headers):
    r = client.get("/api/v1/reports/aging", headers=auth_headers)
    assert r.status_code == 200


def test_outstanding_report(client, auth_headers):
    r = client.get("/api/v1/reports/outstanding", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert "rows" in d or isinstance(d, list)


def test_collections_and_unallocated_reports(client, auth_headers):
    r1 = client.get("/api/v1/reports/collections", headers=auth_headers)
    assert r1.status_code == 200
    assert "rows" in r1.json()

    r2 = client.get("/api/v1/reports/unallocated", headers=auth_headers)
    assert r2.status_code == 200
    assert "rows" in r2.json()


def test_invoice_formulas_and_customer_financials(client, auth_headers):
    """Test full formula: subtotal - discount + additional_charges = total_amount.
    Test customer list and ledger return correct running balances.
    """
    # 1. Create a fresh customer
    cust_res = client.post("/api/v1/customers", headers=auth_headers, json={
        "name": "Patel Krishi Kendra",
        "phone": "9825098250",
        "opening_balance": "500.00",
    })
    assert cust_res.status_code == 201
    cust = cust_res.json()
    assert float(cust["opening_balance"]) == 500.00
    assert float(cust["current_balance"]) == 500.00

    # 2. Create a product
    prod_res = client.post("/api/v1/products", headers=auth_headers, json={
        "name": "NPK Fertilizer 50kg",
        "unit": "bag",
        "unit_price": "1450.00",
        "tax_rate": "0.00",
    })
    assert prod_res.status_code == 201
    prod = prod_res.json()

    # 3. Create invoice with discount + additional charges
    # 2 bags @ 1450 = 2900 - 100 discount + 50 transport charge = 2850
    inv_res = client.post("/api/v1/invoices", headers=auth_headers, json={
        "customer_id": cust["id"],
        "invoice_date": str(date.today()),
        "discount_amount": "100.00",
        "additional_charges": "50.00",
        "items": [
            {
                "product_id": prod["id"],
                "quantity": "2.000",
                "unit_price": "1450.00",
            }
        ],
    })
    assert inv_res.status_code == 201
    inv = inv_res.json()
    assert float(inv["subtotal"]) == 2900.00
    assert float(inv["discount_amount"]) == 100.00
    assert float(inv["tax_amount"]) == 50.00
    assert float(inv["total_amount"]) == 2850.00
    assert float(inv["balance_due"]) == 2850.00

    # Verify line item resolved product name and unit
    assert inv["items"][0]["product_name"] == "NPK Fertilizer 50kg"
    assert inv["items"][0]["unit"] == "bag"

    # 4. Check customer balance
    c_check = client.get(f"/api/v1/customers/{cust['id']}", headers=auth_headers).json()
    # opening 500 + invoiced 2850 = 3350
    assert float(c_check["total_debits"]) == 2850.00
    assert float(c_check["total_credits"]) == 0.00
    assert float(c_check["current_balance"]) == 3350.00

    # 5. Pay 1850 against invoice
    pay_res = client.post("/api/v1/payments", headers=auth_headers, json={
        "customer_id": cust["id"],
        "payment_date": str(date.today()),
        "amount": "1850.00",
        "mode": "upi",
        "allocations": [
            {"invoice_id": inv["id"], "allocated_amount": "1850.00"}
        ],
    })
    assert pay_res.status_code == 201

    # Check invoice balance
    inv_check = client.get(f"/api/v1/invoices/{inv['id']}", headers=auth_headers).json()
    assert float(inv_check["amount_paid"]) == 1850.00
    assert float(inv_check["balance_due"]) == 1000.00
    assert inv_check["status"] == "partial"

    # 6. Check Customer Ledger
    ledger = client.get(f"/api/v1/customers/{cust['id']}/ledger", headers=auth_headers).json()
    assert float(ledger["opening_balance"]) == 500.00
    assert float(ledger["closing_balance"]) == 1500.00  # 3350 - 1850
    assert float(ledger["current_balance"]) == 1500.00
    assert len(ledger["entries"]) >= 3  # opening, invoice, payment

    # Ensure each ledger entry has an id
    inv_entry = next(e for e in ledger["entries"] if e["type"] == "invoice")
    assert inv_entry["id"] == inv["id"]

