"""
Pytest configuration: in-memory SQLite test database and test client.
Uses SQLite so tests run without any external database server.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models import User
from app.security import hash_password

TEST_DATABASE_URL = "sqlite:///./test_khata.db"

engine_test = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False,
                                   bind=engine_test)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine_test)
    Base.metadata.create_all(bind=engine_test)
    db = TestingSessionLocal()
    admin = User(
        username="testadmin",
        full_name="Test Admin",
        email="admin@test.local",
        hashed_password=hash_password("testpass123"),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def client(setup_db):
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limits():
    from app.routers.auth import _FAILED_LOGIN_ATTEMPTS
    _FAILED_LOGIN_ATTEMPTS.clear()
    yield
    _FAILED_LOGIN_ATTEMPTS.clear()


@pytest.fixture
def auth_headers(client):
    from app.routers.auth import _FAILED_LOGIN_ATTEMPTS
    _FAILED_LOGIN_ATTEMPTS.clear()
    resp = client.post("/api/v1/auth/login",
                       json={"username": "testadmin", "password": "testpass123"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
