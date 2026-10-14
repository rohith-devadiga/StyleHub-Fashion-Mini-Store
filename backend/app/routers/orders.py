import stripe
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..deps import DB, CurrentUser
from ..models import CartItem, Order, OrderItem, Product
from ..schemas import CheckoutOut, OrderOut

router = APIRouter(tags=["orders"])

CURRENCY = "inr"  # amounts are in paise (100 paise = Rs 1)


def _require_stripe():
    if not settings.stripe_secret_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Stripe is not configured on the server")
    stripe.api_key = settings.stripe_secret_key


def apply_payment_result(db: Session, order: Order, intent_status: str, has_error: bool = False) -> None:
    """Update order status from a Stripe PaymentIntent status. Safe to call repeatedly."""
    if order.status == "paid":
        return
    if intent_status == "succeeded":
        order.status = "paid"
        for item in order.items:
            product = db.get(Product, item.product_id)
            if product:
                product.stock = max(0, product.stock - item.quantity)
        db.execute(delete(CartItem).where(CartItem.user_id == order.user_id))
    elif intent_status == "canceled" or (intent_status == "requires_payment_method" and has_error):
        order.status = "failed"
    db.commit()


def _get_own_order(db: Session, order_id: int, user_id: int) -> Order:
    order = db.scalar(
        select(Order).where(Order.id == order_id, Order.user_id == user_id).options(joinedload(Order.items))
    )
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


@router.post("/orders/checkout", response_model=CheckoutOut, status_code=status.HTTP_201_CREATED)
def checkout(db: DB, user: CurrentUser):
    """Turn the cart into a pending order and create a Stripe PaymentIntent for it."""
    _require_stripe()
    cart = db.scalars(
        select(CartItem).where(CartItem.user_id == user.id).options(joinedload(CartItem.product))
    ).all()
    if not cart:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty")

    for row in cart:
        if row.quantity > row.product.stock:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Only {row.product.stock} in stock for '{row.product.name}'"
            )

    total = sum(r.product.price_cents * r.quantity for r in cart)

    def build_items():
        return [
            OrderItem(
                product_id=r.product_id,
                name=r.product.name,
                unit_price_cents=r.product.price_cents,
                quantity=r.quantity,
            )
            for r in cart
        ]

    # Reuse the user's latest unpaid order instead of creating a new one on every visit.
    existing = db.scalar(
        select(Order)
        .where(
            Order.user_id == user.id,
            Order.status == "pending",
            Order.stripe_payment_intent_id.is_not(None),
        )
        .options(joinedload(Order.items))
        .order_by(Order.id.desc())
    )
    if existing:
        try:
            intent = stripe.PaymentIntent.retrieve(existing.stripe_payment_intent_id)
            if intent.currency == CURRENCY and intent.status in (
                "requires_payment_method",
                "requires_confirmation",
                "requires_action",
            ):
                if intent.amount != total:
                    intent = stripe.PaymentIntent.modify(intent.id, amount=total)
                existing.items = build_items()  # cart may have changed since last time
                existing.total_cents = total
                db.commit()
                return CheckoutOut(order_id=existing.id, client_secret=intent.client_secret, total_cents=total)
            # Already paid / cancelled / processing: sync its status, then start a fresh order below.
            apply_payment_result(db, existing, intent.status, has_error=bool(intent.last_payment_error))
        except stripe.StripeError:
            pass  # can't reuse it; fall through and create a new order

    order = Order(user_id=user.id, total_cents=total, currency=CURRENCY, status="pending")
    order.items = build_items()
    db.add(order)
    db.flush()  # get order.id

    try:
        intent = stripe.PaymentIntent.create(
            amount=total,
            currency=CURRENCY,
            automatic_payment_methods={"enabled": True},
            metadata={"order_id": str(order.id), "user_id": str(user.id)},
        )
    except stripe.StripeError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Payment provider error: {exc.user_message or 'unknown'}")

    order.stripe_payment_intent_id = intent.id
    db.commit()
    return CheckoutOut(order_id=order.id, client_secret=intent.client_secret, total_cents=total)


@router.post("/orders/{order_id}/confirm", response_model=OrderOut)
def confirm_order(order_id: int, db: DB, user: CurrentUser):
    """Called by the frontend after Stripe.js finishes; verifies the real status with Stripe."""
    order = _get_own_order(db, order_id, user.id)
    if order.status == "pending" and order.stripe_payment_intent_id:
        _require_stripe()
        try:
            intent = stripe.PaymentIntent.retrieve(order.stripe_payment_intent_id)
        except stripe.StripeError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Payment provider error: {exc.user_message or 'unknown'}")
        apply_payment_result(db, order, intent.status, has_error=bool(intent.last_payment_error))
        db.refresh(order)
    return order


@router.get("/orders", response_model=list[OrderOut])
def list_orders(db: DB, user: CurrentUser):
    return db.scalars(
        select(Order).where(Order.user_id == user.id).options(joinedload(Order.items)).order_by(Order.id.desc())
    ).unique().all()


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: DB, user: CurrentUser):
    return _get_own_order(db, order_id, user.id)


@router.post("/payments/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: DB):
    if not settings.stripe_webhook_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Webhook secret not configured")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature")

    if event["type"] in ("payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"):
        intent = event["data"]["object"]
        order = db.scalar(
            select(Order).where(Order.stripe_payment_intent_id == intent["id"]).options(joinedload(Order.items))
        )
        if order:
            apply_payment_result(
                db, order, intent["status"], has_error=bool(intent.get("last_payment_error"))
            )
    return {"received": True}