# StyleHub – Fashion Mini Store

FastAPI + SQLite + JWT backend, React (Vite) frontend, Stripe test-mode payments.

```
stylehub/
├── backend/    FastAPI app (app/), requirements.txt, .env.example
└── frontend/   React + Vite app (src/), package.json, .env.example
```

## Run the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env     # then fill in SECRET_KEY and your Stripe test keys
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs. Tables are created automatically on startup (SQLite file `stylehub.db`).

## Run the frontend

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:5173.

## Stripe (test mode)

1. Get test keys from https://dashboard.stripe.com/test/apikeys and put them in `backend/.env`
   (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`). Keys stay on the server; the frontend
   fetches only the publishable key from `GET /config`.
2. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.
   Declined-card test: `4000 0000 0000 0002`.
3. Optional webhook (recommended in real deployments):
   `stripe listen --forward-to localhost:8000/payments/webhook`, then set `STRIPE_WEBHOOK_SECRET`.

## Adding products

There is no seed data. Log in, open `/docs`, click **Authorize** with your token, and call `POST /products`:

```json
{ "name": "Linen Shirt", "description": "Relaxed fit", "price_cents": 4900,
  "image_url": "", "category": "Shirts", "stock": 25 }
```

Prices are stored in cents. Any logged-in user can create products (the brief has no admin role).

## API overview

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | – | Create account (bcrypt-hashed password) |
| POST | `/auth/login` | – | Returns JWT |
| GET | `/auth/me` | ✔ | Current user |
| GET | `/products`, `/products/{id}` | – | List (search `q`, `category`) / detail |
| POST | `/products` | ✔ | Create product |
| GET | `/cart` | ✔ | Cart with line totals and total |
| POST | `/cart/items` | ✔ | Add item `{product_id, quantity}` |
| PATCH / DELETE | `/cart/items/{product_id}` | ✔ | Update quantity / remove |
| POST | `/orders/checkout` | ✔ | Create pending order + Stripe PaymentIntent, returns `client_secret` |
| POST | `/orders/{id}/confirm` | ✔ | Verify PaymentIntent with Stripe, update order status |
| GET | `/orders`, `/orders/{id}` | ✔ | Order history |
| POST | `/payments/webhook` | Stripe signature | Updates order status from Stripe events |

## Payment flow

1. Cart page → **Checkout** calls `POST /orders/checkout`. The server recalculates the total from
   the database (never trusts client prices), creates a `pending` order and a PaymentIntent.
2. The frontend renders Stripe's `PaymentElement` with the `client_secret` and calls `confirmPayment`.
3. The result page calls `POST /orders/{id}/confirm`; the server asks Stripe for the real status and
   sets the order to `paid` (stock decremented, cart cleared) or `failed`. The webhook does the same
   independently, and the update is idempotent.

## Security notes

- Passwords hashed with bcrypt; JWT (HS256) signed with `SECRET_KEY` from the environment.
- Stripe keys and the JWT secret come from environment variables; `.env` is git-ignored.
- All data access uses the SQLAlchemy ORM (no raw SQL). Request bodies are validated with Pydantic.
- Cart and order endpoints are scoped to the logged-in user.
- Before production: use a long random `SECRET_KEY`, add rate limiting on `/auth/login`, store the
  token in an httpOnly cookie instead of localStorage, and restrict `POST /products` to an admin role.
