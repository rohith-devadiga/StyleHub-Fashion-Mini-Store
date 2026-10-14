import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, formatPrice } from "../api";
import { useAuth } from "../AuthContext";
import { useCart } from "../CartContext";
import ProductImage from "../components/ProductImage";

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api
      .product(id)
      .then(setProduct)
      .catch((e) => setError(e.message));
  }, [id]);

  const addToCart = async () => {
    if (!user) return navigate("/login", { state: { from: `/products/${id}` } });
    setError("");
    try {
      await add(product.id, qty);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !product) return <p className="alert">{error}</p>;
  if (!product) return <p className="muted">Loading…</p>;

  return (
    <div className="detail card">
      <ProductImage product={product} className="detail-img" />
      <div className="detail-body">
        <span className="muted small">{product.category}</span>
        <h1>{product.name}</h1>
        <p className="price">{formatPrice(product.price_cents)}</p>
        <p>{product.description}</p>
        <p className="muted small">{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
        {error && <p className="alert">{error}</p>}
        <div className="row">
          <input
            className="qty"
            type="number"
            min={1}
            max={Math.max(1, product.stock)}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
          <button className="btn btn-primary" disabled={product.stock === 0} onClick={addToCart}>
            {added ? "Added ✓" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
