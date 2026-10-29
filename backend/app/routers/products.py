"""Products CRUD router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Product
from app.schemas import ProductCreate, ProductUpdate, ProductOut
from app.dependencies import CurrentUser, add_audit

router = APIRouter(prefix="/products", tags=["products"])


def _next_product_code(db: Session) -> str:
    count = db.query(func.count(Product.id)).scalar() or 0
    return f"PRD-{count + 1:04d}"


@router.get("", response_model=List[ProductOut])
def list_products(
    *,
    q: Optional[str] = Query(None),
    active_only: bool = True,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    if active_only:
        query = query.filter(Product.is_active == True)
    if q:
        query = query.filter(Product.name.ilike(f"%{q}%"))
    return query.order_by(Product.name).all()


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductCreate, current_user: CurrentUser,
                   db: Session = Depends(get_db)):
    product = Product(code=_next_product_code(db), **body.model_dump())
    db.add(product)
    db.flush()
    add_audit(db, current_user, "create_product", "product", product.id,
              f"Created: {product.name}")
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, current_user: CurrentUser,
                db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate,
                   current_user: CurrentUser, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    old_stock = p.current_stock
    updates = body.model_dump(exclude_none=True)
    for k, v in updates.items():
        setattr(p, k, v)
    details = f"Updated product: {p.name}"
    if "current_stock" in updates and updates["current_stock"] != old_stock:
        details += f" (Stock adjusted: {old_stock} -> {p.current_stock} {p.unit})"
    add_audit(db, current_user, "update_product", "product", product_id, details)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{product_id}", response_model=ProductOut)
def put_product(product_id: int, body: ProductUpdate,
                current_user: CurrentUser, db: Session = Depends(get_db)):
    return update_product(product_id, body, current_user, db)


@router.patch("/{product_id}/toggle-status", response_model=ProductOut)
def toggle_product_status(product_id: int, current_user: CurrentUser,
                          db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    p.is_active = not p.is_active
    action = "activate_product" if p.is_active else "deactivate_product"
    add_audit(db, current_user, action, "product", product_id)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, current_user: CurrentUser,
                   db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    p.is_active = False
    add_audit(db, current_user, "deactivate_product", "product", product_id)
    db.commit()
