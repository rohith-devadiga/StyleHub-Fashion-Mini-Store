from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from ..deps import DB, CurrentUser
from ..models import CartItem, Product, User
from ..schemas import CartAdd, CartItemOut, CartOut, CartUpdate

router = APIRouter(prefix="/cart", tags=["cart"])


def build_cart(db: Session, user: User) -> CartOut:
    rows = db.scalars(
        select(CartItem)
        .where(CartItem.user_id == user.id)
        .options(joinedload(CartItem.product))
        .order_by(CartItem.id)
    ).all()
    items = [
        CartItemOut(product=r.product, quantity=r.quantity, line_total_cents=r.product.price_cents * r.quantity)
        for r in rows
    ]
    return CartOut(
        items=items,
        total_cents=sum(i.line_total_cents for i in items),
        item_count=sum(i.quantity for i in items),
    )


def _get_product_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if not product or not product.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


def _check_stock(product: Product, quantity: int):
    if quantity > product.stock:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Only {product.stock} in stock for '{product.name}'")


@router.get("", response_model=CartOut)
def get_cart(db: DB, user: CurrentUser):
    return build_cart(db, user)


@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
def add_to_cart(payload: CartAdd, db: DB, user: CurrentUser):
    product = _get_product_or_404(db, payload.product_id)
    item = db.scalar(select(CartItem).where(CartItem.user_id == user.id, CartItem.product_id == product.id))
    new_qty = payload.quantity + (item.quantity if item else 0)
    _check_stock(product, new_qty)
    if item:
        item.quantity = new_qty
    else:
        db.add(CartItem(user_id=user.id, product_id=product.id, quantity=new_qty))
    db.commit()
    return build_cart(db, user)


@router.patch("/items/{product_id}", response_model=CartOut)
def update_quantity(product_id: int, payload: CartUpdate, db: DB, user: CurrentUser):
    item = db.scalar(select(CartItem).where(CartItem.user_id == user.id, CartItem.product_id == product_id))
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not in cart")
    _check_stock(_get_product_or_404(db, product_id), payload.quantity)
    item.quantity = payload.quantity
    db.commit()
    return build_cart(db, user)


@router.delete("/items/{product_id}", response_model=CartOut)
def remove_from_cart(product_id: int, db: DB, user: CurrentUser):
    item = db.scalar(select(CartItem).where(CartItem.user_id == user.id, CartItem.product_id == product_id))
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not in cart")
    db.delete(item)
    db.commit()
    return build_cart(db, user)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(db: DB, user: CurrentUser):
    db.execute(delete(CartItem).where(CartItem.user_id == user.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)