import { useState } from "react";
import Modal from "../components/Modal";
export default function CheckoutModal({ onClose, total, user, onPlaceOrder }) {
  const [address, setAddress] = useState(user?.address || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) { e.preventDefault(); setBusy(true); setMessage(""); try { await onPlaceOrder(address); } catch(err) { setMessage(err.message); } finally { setBusy(false); } }
  return <Modal title="Checkout" onClose={onClose}>
    <p className="modal-intro">Review your delivery details before placing your demo order.</p>
    <form className="form-stack" onSubmit={submit}>
      <label>Delivery address<textarea value={address} onChange={e=>setAddress(e.target.value)} required minLength="5" rows="3" placeholder="Street, city, postcode"/></label>
      <div className="checkout-total"><span>Order total</span><strong>€{total.toFixed(2)}</strong></div>
      <p className="fine-print">This is a lab prototype. No real payment will be collected.</p>
      {message && <p className="form-error">{message}</p>}
      <button className="button button-dark button-full" disabled={busy}>{busy ? "Placing order…" : "Place demo order"}</button>
    </form>
  </Modal>;
}
