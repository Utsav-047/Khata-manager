"""SQLAlchemy 2.x database engine, session factory, and base model."""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings

settings = get_settings()

connect_args = {}
if settings.db_ssl or "tidbcloud.com" in settings.db_host.lower():
    connect_args["ssl"] = {"ssl_mode": "REQUIRED"}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,          # detect stale connections
    pool_recycle=3600,           # recycle connections hourly
    pool_size=10,
    max_overflow=20,
    echo=(settings.app_env == "development"),
)

# Enforce foreign keys on every connection (MariaDB/MySQL requires this per-session)
@event.listens_for(engine, "connect")
def set_sql_mode(dbapi_connection, connection_record):
    with dbapi_connection.cursor() as cursor:
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")
        cursor.execute("SET sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a DB session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
