"""add product stock and user phone

Revision ID: a1b2c3d4e5f6
Revises: f3d1a094a6f8
Create Date: 2026-10-29 11:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f3d1a094a6f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to include product inventory stock and user phone."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    product_cols = [c["name"] for c in inspector.get_columns("products")] if inspector.has_table("products") else []
    user_cols = [c["name"] for c in inspector.get_columns("users")] if inspector.has_table("users") else []

    if "current_stock" not in product_cols:
        op.add_column(
            'products',
            sa.Column('current_stock', sa.DECIMAL(precision=15, scale=3), nullable=False, server_default='0.000')
        )
    if "min_stock_alert" not in product_cols:
        op.add_column(
            'products',
            sa.Column('min_stock_alert', sa.DECIMAL(precision=15, scale=3), nullable=False, server_default='10.000')
        )
    if "phone" not in user_cols:
        op.add_column(
            'users',
            sa.Column('phone', sa.String(length=20), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('products', 'min_stock_alert')
    op.drop_column('products', 'current_stock')
    op.drop_column('users', 'phone')

