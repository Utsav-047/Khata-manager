"""Tests: customer CRUD + ledger."""
from datetime import date


def test_create_customer(client, auth_headers):
    r = client.post("/api/v1/customers", headers=auth_headers, json={
        "name": "Ramesh Kumar",
        "phone": "9876543210",
        "city": "Delhi",
        "credit_limit": "50000.00",
        "opening_balance": "5000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Ramesh Kumar"
    assert data["code"].startswith("CUST-")
    assert float(data["opening_balance"]) == 5000.00


def test_list_customers(client, auth_headers):
    r = client.get("/api/v1/customers", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_search_customers(client, auth_headers):
    r = client.get("/api/v1/customers?q=Ramesh", headers=auth_headers)
    assert r.status_code == 200


def test_update_customer(client, auth_headers):
    # Get any customer
    r = client.get("/api/v1/customers", headers=auth_headers)
    cust = r.json()[0]
    r2 = client.patch(f"/api/v1/customers/{cust['id']}", headers=auth_headers,
                      json={"city": "Mumbai"})
    assert r2.status_code == 200
    assert r2.json()["city"] == "Mumbai"


def test_customer_balance(client, auth_headers):
    r = client.get("/api/v1/customers", headers=auth_headers)
    cust_id = r.json()[0]["id"]
    r2 = client.get(f"/api/v1/customers/{cust_id}/balance",
                    headers=auth_headers)
    assert r2.status_code == 200
    assert "current_balance" in r2.json()


def test_customer_ledger(client, auth_headers):
    r = client.get("/api/v1/customers", headers=auth_headers)
    cust_id = r.json()[0]["id"]
    r2 = client.get(f"/api/v1/customers/{cust_id}/ledger",
                    headers=auth_headers)
    assert r2.status_code == 200
    assert "entries" in r2.json()
    assert "closing_balance" in r2.json()


def test_customer_not_found(client, auth_headers):
    r = client.get("/api/v1/customers/99999", headers=auth_headers)
    assert r.status_code == 404


def test_customer_phone_and_email_validation(client, auth_headers):
    # Invalid phone (less than 10 digits)
    r_bad_phone = client.post("/api/v1/customers", headers=auth_headers, json={
        "name": "Invalid Phone Test",
        "phone": "12345",
    })
    assert r_bad_phone.status_code == 422

    # Invalid email
    r_bad_email = client.post("/api/v1/customers", headers=auth_headers, json={
        "name": "Invalid Email Test",
        "phone": "9876543210",
        "email": "not-a-valid-email",
    })
    assert r_bad_email.status_code == 422

    # Valid phone with country code +91 and spaces & valid email
    r_valid = client.post("/api/v1/customers", headers=auth_headers, json={
        "name": "Valid Phone Test",
        "phone": "+91 93282 92343",
        "email": "test.farmer@example.com",
    })
    assert r_valid.status_code == 201
    data = r_valid.json()
    assert data["phone"] == "9328292343"
    assert data["email"] == "test.farmer@example.com"
