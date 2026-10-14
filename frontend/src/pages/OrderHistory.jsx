import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatPrice } from "../api";

export default function OrderHistory() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .orders()
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alert">{error}</p>;
  if (!orders) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Your orders</h1>
      {orders.length === 0 && (
        <div className="card center">
          <p>No orders yet.</p>
          <Link to="/" className="btn btn-primary">
            Start shopping
          </Link>
        </div>
      )}
      {orders.map((o) => (
        <div className="card order" key={o.id}>
          <div className="row between">
            <strong>Order #{o.id}</strong>
            <span className={`status status-${o.status}`}>{o.status}</span>
          </div>
          <div className="muted small">{new Date(o.created_at).toLocaleString()}</div>
          <ul>
            {o.items.map((i) => (
              <li key={`${o.id}-${i.product_id}`}>
                {i.name} × {i.quantity} — {formatPrice(i.unit_price_cents * i.quantity, o.currency)}
              </li>
            ))}
          </ul>
          <div className="row between">
            <strong>{formatPrice(o.total_cents, o.currency)}</strong>
            {o.status === "pending" && (
              <Link to={`/orders/${o.id}/result`} className="btn btn-ghost">
                Check payment
              </Link>
            )}
          </div>
        </div>
      ))}
    </>
  );
}