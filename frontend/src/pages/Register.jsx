import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form.full_name, form.email, form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <form className="card form" onSubmit={submit}>
      <h1>Create your account</h1>
      {error && <p className="alert">{error}</p>}
      <label>
        Full name
        <input required maxLength={120} value={form.full_name} onChange={set("full_name")} />
      </label>
      <label>
        Email
        <input type="email" required value={form.email} onChange={set("email")} />
      </label>
      <label>
        Password <span className="muted">(8–72 characters)</span>
        <input type="password" required minLength={8} maxLength={72} value={form.password} onChange={set("password")} />
      </label>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Creating…" : "Sign up"}
      </button>
      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
