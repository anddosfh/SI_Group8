import { useEffect, useState } from "react";
import { api } from "../services/api";
import Modal from "../components/Modal";
export default function OrdersModal({ onClose, user }) {
  const [orders, setOrders] = useState([]); const [error,setError] = useState("");
  useEffect(()=>{ api("/orders/mine").then(r=>setOrders(r.orders || [])).catch(e=>setError(e.message)); },[]);
  return <Modal title="Order history" onClose={onClose} wide>
    {!user && <p className="form-error">Please sign in to view orders.</p>}
    {error && <p className="form-error">{error}</p>}
    {orders.length === 0 && !error ? <div className="empty-state"><h3>No orders yet</h3><p>Your future orders will appear here.</p></div> : <div className="orders-list">{orders.map(o=><article className="order-card" key={o.id}><div className="order-top"><div><span className="product-category">ORDER #{o.id}</span><h3>{new Date(o.createdAt).toLocaleDateString()}</h3></div><span className={`status status-${o.status}`}>{o.status}</span></div><p>{o.items.map(i=>`${i.quantity} × ${i.name}`).join(", ")}</p><strong>€{Number(o.total).toFixed(2)}</strong></article>)}</div>}
  </Modal>;
}
