from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth ----
class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=72)  # bcrypt limit is 72 bytes


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    email: EmailStr
    full_name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- products ----
class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    price: int = Field(gt=0, description="Price in whole rupees, e.g. 1500 for Rs 1500")
    image_url: str = ""
    category: str = ""
    stock: int = Field(ge=0, default=0)


class ProductOut(ORM):
    id: int
    name: str
    description: str
    price_cents: int
    image_url: str
    category: str
    stock: int


# ---- cart ----
class CartAdd(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=99, default=1)


class CartUpdate(BaseModel):
    quantity: int = Field(ge=1, le=99)


class CartItemOut(BaseModel):
    product: ProductOut
    quantity: int
    line_total_cents: int


class CartOut(BaseModel):
    items: list[CartItemOut]
    total_cents: int
    item_count: int


# ---- orders ----
class OrderItemOut(ORM):
    product_id: int
    name: str
    unit_price_cents: int
    quantity: int


class OrderOut(ORM):
    id: int
    total_cents: int
    currency: str
    status: str
    created_at: datetime
    items: list[OrderItemOut]


class CheckoutOut(BaseModel):
    order_id: int
    client_secret: str
    total_cents: int