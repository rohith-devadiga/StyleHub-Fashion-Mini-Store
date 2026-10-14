import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatPrice } from "../api";
import { useCart } from "../CartContext";

function PayForm({ orderId, total }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError("");

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      // Only used if the payment method needs a redirect (3DS, bank redirects, ...)
      confirmParams: { return_url: `${window.location.origin}/orders/${orderId}/result` },
      redirect: "if_required",
    });

    if (stripeError) {
      // Card declined, validation problem, etc. The user can fix the details and retry.
      setError(stripeError.message || "Payment failed. Please try again.");
      setBusy(false);
      return;
    }
    // No error and no redirect: the backend verifies the real status with Stripe.
    navigate(`/orders/${orderId}/result`, { replace: true });
  };

  return (
    <form onSubmit={submit}>
      <PaymentElement />
      {error && <p className="alert">{error}</p>}
      <button className="btn btn-primary wide" disabled={!stripe || busy}>
        {busy ? "Processing…" : `Pay ${formatPrice(total)}`}
      </button>
      <p className="muted small">Test mode: use card 4242 4242 4242 4242, any future date, any CVC.</p>
    </form>
  );
}

export default function Checkout() {
  const { cart } = useCart();
  const [stripePromise, setStripePromise] = useState(null);
  const [session, setSession] = useState(null); // { order_id, client_secret, total_cents }
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // avoid creating two orders under StrictMode
    started.current = true;
    (async () => {
      try {
        const { stripe_publishable_key } = await api.config();
        if (!stripe_publishable_key) throw new Error("Stripe publishable key is not configured on the server.");
        setStripePromise(loadStripe(stripe_publishable_key));
        setSession(await api.checkout());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="card">
        <p className="alert">{error}</p>
        <Link to="/cart" className="btn btn-ghost">
          Back to cart
        </Link>
      </div>
    );
  }
  if (!session || !stripePromise) return <p className="muted">Preparing secure checkout…</p>;

  return (
    <div className="checkout">
      <div className="card">
        <h2>Order summary</h2>
        {cart.items.map(({ product, quantity, line_total_cents }) => (
          <div className="row between" key={product.id}>
            <span>
              {product.name} × {quantity}
            </span>
            <span>{formatPrice(line_total_cents)}</span>
          </div>
        ))}
        <div className="row between total-row">
          <span>Total</span>
          <strong>{formatPrice(session.total_cents)}</strong>
        </div>
      </div>
      <div className="card">
        <h2>Payment</h2>
        <Elements stripe={stripePromise} options={{ clientSecret: session.client_secret }}>
          <PayForm orderId={session.order_id} total={session.total_cents} />
        </Elements>
      </div>
    </div>
  );
}
