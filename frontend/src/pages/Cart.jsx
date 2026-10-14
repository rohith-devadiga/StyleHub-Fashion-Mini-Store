import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatPrice } from "../api";
import { useCart } from "../CartContext";
import ProductImage from "../components/ProductImage";

export default function Cart() {
  const { cart, update, remove } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const run = async (fn) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="card center">
        <h1>Your cart is empty</h1>
        <Link to="/" className="btn btn-primary">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1>Your cart</h1>
      {error && <p className="alert">{error}</p>}
      <div className="card">
        {cart.items.map(({ product, quantity, line_total_cents }) => (
          <div className="cart-row" key={product.id}>
            <ProductImage product={product} className="thumb" />
            <div className="grow">
              <Link to={`/products/${product.id}`}>
                <strong>{product.name}</strong>
              </Link>
              <div className="muted small">{formatPrice(product.price_cents)} each</div>
            </div>
            <div className="row">
              <button
                className="btn btn-ghost"
                disabled={quantity <= 1}
                onClick={() => run(() => update(product.id, quantity - 1))}
              >
                −
              </button>
              <span className="qty-text">{quantity}</span>
              <button
                className="btn btn-ghost"
                disabled={quantity >= product.stock}
                onClick={() => run(() => update(product.id, quantity + 1))}
              >
                +
              </button>
            </div>
            <strong className="line-total">{formatPrice(line_total_cents)}</strong>
            <button className="btn btn-ghost" onClick={() => run(() => remove(product.id))} aria-label="Remove">
              ✕
            </button>
          </div>
        ))}
        <div className="row between total-row">
          <span>Total</span>
          <strong className="price">{formatPrice(cart.total_cents)}</strong>
        </div>
        <button className="btn btn-primary wide" onClick={() => navigate("/checkout")}>
          Checkout
        </button>
      </div>
    </>
  );
}
