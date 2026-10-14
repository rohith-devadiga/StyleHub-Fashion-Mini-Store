const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "stylehub_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Amounts are stored in the smallest unit (paise): 4900 -> Rs 49.00
export const formatPrice = (minorUnits, currency = "inr") =>
  new Intl.NumberFormat(currency.toLowerCase() === "inr" ? "en-IN" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0, // whole rupees only, e.g. Rs 149
  }).format(minorUnits / 100);

function errorMessage(data, status) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors
    return detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
  }
  return `Request failed (${status})`;
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && auth && token) {
      clearToken();
      window.dispatchEvent(new Event("stylehub:unauthorized"));
    }
    throw new Error(errorMessage(data, res.status));
  }
  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),
  me: () => request("/auth/me"),
  config: () => request("/config", { auth: false }),

  products: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/products${qs ? `?${qs}` : ""}`, { auth: false });
  },
  product: (id) => request(`/products/${id}`, { auth: false }),

  cart: () => request("/cart"),
  addToCart: (product_id, quantity = 1) =>
    request("/cart/items", { method: "POST", body: { product_id, quantity } }),
  updateCartItem: (product_id, quantity) =>
    request(`/cart/items/${product_id}`, { method: "PATCH", body: { quantity } }),
  removeCartItem: (product_id) => request(`/cart/items/${product_id}`, { method: "DELETE" }),

  checkout: () => request("/orders/checkout", { method: "POST" }),
  confirmOrder: (id) => request(`/orders/${id}/confirm`, { method: "POST" }),
  orders: () => request("/orders"),
};