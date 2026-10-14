import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);
const EMPTY = { items: [], total_cents: 0, item_count: 0 };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY);

  const refresh = useCallback(async () => {
    setCart(await api.cart());
  }, []);

  useEffect(() => {
    if (user) refresh().catch(() => {});
    else setCart(EMPTY);
  }, [user, refresh]);

  const add = useCallback(async (productId, qty = 1) => setCart(await api.addToCart(productId, qty)), []);
  const update = useCallback(async (productId, qty) => setCart(await api.updateCartItem(productId, qty)), []);
  const remove = useCallback(async (productId) => setCart(await api.removeCartItem(productId)), []);

  const value = useMemo(() => ({ cart, refresh, add, update, remove }), [cart, refresh, add, update, remove]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
