import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatPrice } from "../api";
import ProductImage from "../components/ProductImage";

export default function Products() {
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .products({ q })
        .then((p) => {
          setProducts(p);
          setError("");
        })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <div className="page-head">
        <h1>New arrivals</h1>
        <input className="search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="alert">{error}</p>}
      {products === null && !error && <p className="muted">Loading…</p>}
      {products?.length === 0 && (
        <p className="muted card">
          {q ? "No products match your search." : "No products yet. Add some with POST /products in the API docs at /docs."}
        </p>
      )}
      <div className="grid">
        {products?.map((p) => (
          <Link to={`/products/${p.id}`} key={p.id} className="card product-card">
            <ProductImage product={p} />
            <div className="product-info">
              <span className="muted small">{p.category}</span>
              <h3>{p.name}</h3>
              <div className="row between">
                <strong>{formatPrice(p.price_cents)}</strong>
                {p.stock === 0 && <span className="tag">Sold out</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
