"""Tests: authentication endpoints."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "UP"


def test_login_success(client):
    r = client.post("/api/v1/auth/login",
                    json={"username": "testadmin", "password": "testpass123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["role"] == "admin"


def test_login_wrong_password(client):
    r = client.post("/api/v1/auth/login",
                    json={"username": "testadmin", "password": "wrong"})
    assert r.status_code == 401


def test_whoami(client, auth_headers):
    r = client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["username"] == "testadmin"


def test_protected_without_token(client):
    r = client.get("/api/v1/customers")
    assert r.status_code == 401


def test_login_with_email(client):
    r = client.post("/api/v1/auth/login",
                    json={"username": "admin@test.local", "password": "testpass123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["role"] == "admin"


def test_login_rate_limiting(client):
    from app.routers.auth import _FAILED_LOGIN_ATTEMPTS
    _FAILED_LOGIN_ATTEMPTS.clear()
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"username": "testadmin", "password": "wrongpassword"})
    
    r_blocked = client.post("/api/v1/auth/login", json={"username": "testadmin", "password": "wrongpassword"})
    assert r_blocked.status_code == 429
    assert "Too many failed login attempts" in r_blocked.json()["detail"]
    _FAILED_LOGIN_ATTEMPTS.clear()
