import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatPrice } from "../api";
import { useCart } from "../CartContext";

export default function OrderResult() {
  const { id } = useParams();
  const { refresh } = useCart();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  const load = async () => {
    try {
      const o = await api.confirmOrder(id);
      setOrder(o);
      refresh().catch(() => {}); // cart is cleared server-side once paid
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="alert">{error}</p>;
  if (!order) return <p className="muted">Confirming your payment…</p>;

  const copy = {
    paid: { title: "Payment successful 🎉", text: `Thanks! Order #${order.id} is confirmed.` },
    failed: { title: "Payment failed", text: "Your card was not charged. Your cart is still saved, so you can try again." },
    pending: { title: "Payment processing", text: "We haven't received confirmation yet. Check again in a moment." },
  }[order.status];

  return (
    <div className="card center">
      <h1>{copy.title}</h1>
      <p>{copy.text}</p>
      <p className="muted">Total: {formatPrice(order.total_cents, order.currency)}</p>
      <div className="row center-row">
        {order.status === "pending" && (
          <button className="btn btn-primary" onClick={load}>
            Check again
          </button>
        )}
        {order.status === "failed" && (
          <Link to="/cart" className="btn btn-primary">
            Back to cart
          </Link>
        )}
        <Link to="/orders" className="btn btn-ghost">
          View orders
        </Link>
      </div>
    </div>
  );
}