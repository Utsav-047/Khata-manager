"""Auth router: login, logout, whoami, password change."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (LoginRequest, PasswordChangeRequest, TokenResponse,
                         MessageResponse, UserOut)
from app.security import verify_password, hash_password, create_access_token
from app.dependencies import CurrentUser, add_audit

router = APIRouter(prefix="/auth", tags=["auth"])


from collections import defaultdict
import time

# Rate limiter: max 5 failed attempts per minute per IP to prevent brute-force attacks
_FAILED_LOGIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_MAX_LOGIN_ATTEMPTS = 5
_WINDOW_SECONDS = 60

def _check_rate_limit(client_ip: str) -> None:
    now = time.time()
    attempts = [t for t in _FAILED_LOGIN_ATTEMPTS[client_ip] if now - t < _WINDOW_SECONDS]
    _FAILED_LOGIN_ATTEMPTS[client_ip] = attempts
    if len(attempts) >= _MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 60 seconds before trying again.",
        )

def _record_failed_attempt(client_ip: str) -> None:
    _FAILED_LOGIN_ATTEMPTS[client_ip].append(time.time())

def _reset_attempts(client_ip: str) -> None:
    _FAILED_LOGIN_ATTEMPTS.pop(client_ip, None)

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    login_id = (req.username or '').strip()
    user = db.query(User).filter(
        (User.username == login_id) | (User.email == login_id)
    ).first()
    if not user or not verify_password(req.password, user.hashed_password):
        _record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    
    _reset_attempts(client_ip)
    token = create_access_token({"sub": str(user.id)})
    add_audit(db, user, "login", "user", user.id,
              ip=request.client.host if request.client else None)
    db.commit()
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
    )


@router.get("/me", response_model=UserOut)
def whoami(current_user: CurrentUser):
    return current_user


@router.post("/logout", response_model=MessageResponse)
def logout(current_user: CurrentUser, db: Session = Depends(get_db)):
    """Audit-only logout: JWTs are stateless, so the client discards the token."""
    add_audit(db, current_user, "logout", "user", current_user.id)
    db.commit()
    return MessageResponse(message="Logged out successfully")


@router.post("/change-password", response_model=MessageResponse)
def change_password(body: PasswordChangeRequest, current_user: CurrentUser,
                    db: Session = Depends(get_db)):
    """Self-service password change for the signed-in user."""
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="User not found")
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.hashed_password = hash_password(body.new_password)
    add_audit(db, user, "change_password", "user", user.id)
    db.commit()
    return MessageResponse(message="Password updated successfully")
