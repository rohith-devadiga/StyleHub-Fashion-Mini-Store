from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from ..deps import DB, CurrentUser
from ..models import CartItem, OrderItem, Product
from ..schemas import ProductCreate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


class ProductUpdate(BaseModel):
    """All fields optional: send only what you want to change."""

    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    price: int | None = Field(default=None, gt=0, description="Price in whole rupees, e.g. 1500")
    image_url: str | None = None
    category: str | None = None
    stock: int | None = Field(default=None, ge=0)


@router.get("", response_model=list[ProductOut])
def list_products(
    db: DB,
    category: str | None = None,
    q: str | None = Query(default=None, description="Search by name"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    stmt = select(Product).where(Product.is_active.is_(True)).order_by(Product.id)
    if category:
        stmt = stmt.where(Product.category == category)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    return db.scalars(stmt.offset(skip).limit(limit)).all()


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: DB):
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: DB, _user: CurrentUser):
    # Any logged-in user can add products for now (no seed data, no admin role in the brief).
    data = payload.model_dump()
    price = data.pop("price")
    product = Product(**data, price_cents=price * 100)  # stored in paise, entered in rupees
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: DB, _user: CurrentUser):
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "price" in changes:
        changes["price_cents"] = changes.pop("price") * 100  # rupees -> paise
    for field, value in changes.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: DB, _user: CurrentUser):
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    db.execute(delete(CartItem).where(CartItem.product_id == product_id))  # remove from carts

    if db.scalar(select(OrderItem.id).where(OrderItem.product_id == product_id).limit(1)):
        # Past orders still refer to it, so hide it from the shop instead of erasing the row.
        product.is_active = False
    else:
        db.delete(product)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)