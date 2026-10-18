import { useState } from "react";
import { api, getToken, setSession } from "../services/api";
import Modal from "../components/Modal";
export default function AccountModal({ onClose, user, setUser, onOrders }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name:"", email:"", password:"", address:"" });
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({ name:"", address:"" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const change = e => setForm({ ...form, [e.target.name]: e.target.value });
  const changeProfile = e => setProfile({ ...profile, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await api(mode === "register" ? "/auth/register" : "/auth/login", { method:"POST", body:JSON.stringify(form) });
      setSession(result.token, result.user); setUser(result.user); onClose();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  function startEditing() { setProfile({ name:user.name, address:user.address || "" }); setMessage(""); setEditing(true); }
  async function saveProfile(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await api("/auth/me", { method:"PUT", body:JSON.stringify(profile) });
      setSession(getToken(), result.user); setUser(result.user); setEditing(false); setMessage("Your details have been updated.");
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  }
  if (user && editing) return <Modal title="Edit your details" onClose={onClose}>
    <form className="form-stack" onSubmit={saveProfile}>
      <label>Full name<input name="name" value={profile.name} onChange={changeProfile} required minLength="2" placeholder="Your name"/></label>
      <label>Email address<input type="email" value={user.email} disabled/></label>
      <label>Delivery address<textarea name="address" value={profile.address} onChange={changeProfile} rows="3" placeholder="Street, city, postcode"/></label>
      <p className="fine-print">Your email address is your sign-in name and cannot be changed.</p>
      {message && <p className="form-error">{message}</p>}
      <button className="button button-dark button-full" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      <button type="button" className="button button-outline button-full" onClick={() => { setEditing(false); setMessage(""); }}>Cancel</button>
    </form>
  </Modal>;
  if (user) return <Modal title="Your account" onClose={onClose}>
    <div className="account-summary"><div className="avatar">{user.name?.slice(0,1).toUpperCase()}</div><h3>{user.name}</h3><p>{user.email}</p><p>{user.address || "No address saved yet"}</p></div>
    <div className="form-stack">
      {message && <p className="form-success">{message}</p>}
      <button className="button button-outline button-full" onClick={startEditing}>Edit details</button>
      <button className="button button-dark button-full" onClick={onOrders}>View order history</button>
    </div>
    <p className="fine-print">Your account information is stored by the NOVA demo API.</p>
  </Modal>;
  return <Modal title={mode === "login" ? "Welcome back" : "Create your account"} onClose={onClose}>
    <p className="modal-intro">{mode === "login" ? "Sign in to view your orders and profile." : "Join NOVA for a simpler way to shop technology."}</p>
    <form className="form-stack" onSubmit={submit}>
      {mode === "register" && <label>Full name<input name="name" value={form.name} onChange={change} required minLength="2" placeholder="Your name"/></label>}
      <label>Email address<input name="email" type="email" value={form.email} onChange={change} required placeholder="you@example.com"/></label>
      <label>Password<input name="password" type="password" value={form.password} onChange={change} required minLength="8" placeholder="At least 8 characters"/></label>
      {mode === "register" && <label>Delivery address<input name="address" value={form.address} onChange={change} placeholder="Street, city, postcode"/></label>}
      {message && <p className="form-error">{message}</p>}
      <button className="button button-dark button-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
    </form>
    <p className="switch-mode">{mode === "login" ? "New to NOVA?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}> {mode === "login" ? "Create account" : "Sign in"}</button></p>
  </Modal>;
}
