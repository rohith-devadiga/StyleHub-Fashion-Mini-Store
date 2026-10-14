from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .config import settings
from .database import Base, engine
from .routers import auth, cart, orders, products


def _add_missing_columns():
    """Tiny migration so an existing stylehub.db gains the products.is_active column."""
    columns = {c["name"] for c in inspect(engine).get_columns("products")}
    if "is_active" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
    yield


app = FastAPI(title="StyleHub – Fashion Mini Store", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(cart.router)
app.include_router(orders.router)


@app.get("/config", tags=["meta"])
def public_config():
    """Publishable (non-secret) Stripe key for the frontend."""
    return {"stripe_publishable_key": settings.stripe_publishable_key}


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}