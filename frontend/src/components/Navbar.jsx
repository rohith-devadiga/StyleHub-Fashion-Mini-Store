import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useCart } from "../CartContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cart } = useCart();

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          Style<span>Hub</span>
        </Link>
        <nav className="nav-links">
          <NavLink to="/">Shop</NavLink>
          {user ? (
            <>
              <NavLink to="/orders">Orders</NavLink>
              <NavLink to="/cart">Cart{cart.item_count > 0 && <b className="badge">{cart.item_count}</b>}</NavLink>
              <span className="muted hello">Hi, {user.full_name.split(" ")[0]}</span>
              <button className="btn btn-ghost" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/register" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
