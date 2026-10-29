"""Tests: product CRUD."""


def test_create_product(client, auth_headers):
    r = client.post("/api/v1/products", headers=auth_headers, json={
        "name": "Wheat Flour 10kg",
        "unit": "bag",
        "unit_price": "450.00",
        "tax_rate": "5.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Wheat Flour 10kg"
    assert data["code"].startswith("PRD-")


def test_list_products(client, auth_headers):
    r = client.get("/api/v1/products", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_update_product(client, auth_headers):
    r = client.get("/api/v1/products", headers=auth_headers)
    prod = r.json()[0]
    r2 = client.patch(f"/api/v1/products/{prod['id']}", headers=auth_headers,
                      json={"unit_price": "475.00"})
    assert r2.status_code == 200
    assert float(r2.json()["unit_price"]) == 475.00


def test_stock_tracking_and_deduction(client, auth_headers):
    # 1. Create a product with 10,000 bags DAP
    r = client.post("/api/v1/products", headers=auth_headers, json={
        "name": "DAP Fertilizer",
        "unit": "Bags",
        "unit_price": "1350.00",
        "tax_rate": "0.00",
        "current_stock": "10000.000",
        "min_stock_alert": "50.000",
    })
    assert r.status_code == 201
    prod = r.json()
    prod_id = prod["id"]
    assert float(prod["current_stock"]) == 10000.0
    assert float(prod["min_stock_alert"]) == 50.0

    # 2. Create customer
    r_c = client.post("/api/v1/customers", headers=auth_headers, json={
        "name": "Utsav Patel Farmer",
        "phone": "9825000000",
    })
    cust_id = r_c.json()["id"]

    # 3. Create invoice selling 100 bags DAP
    from datetime import date
    r_inv = client.post("/api/v1/invoices", headers=auth_headers, json={
        "customer_id": cust_id,
        "invoice_date": str(date.today()),
        "items": [
            {
                "product_id": prod_id,
                "description": "DAP Fertilizer",
                "quantity": "100.000",
                "unit_price": "1350.00",
            }
        ]
    })
    assert r_inv.status_code == 201
    inv_data = r_inv.json()
    inv_id = inv_data["id"]

    # 4. Check stock reduced to 9900 bags
    r_prod_check = client.get(f"/api/v1/products/{prod_id}", headers=auth_headers)
    assert float(r_prod_check.json()["current_stock"]) == 9900.0

    # 5. Cancel invoice and check stock restored to 10000 bags
    r_cancel = client.delete(f"/api/v1/invoices/{inv_id}", headers=auth_headers)
    assert r_cancel.status_code == 204

    r_prod_restored = client.get(f"/api/v1/products/{prod_id}", headers=auth_headers)
    assert float(r_prod_restored.json()["current_stock"]) == 10000.0
