import { useEffect, useState } from "react";
import { api } from "../services/api";
import Modal from "../components/Modal";
const blank = { name:"", description:"", price:"", category:"Phones", image:"" };
export default function AdminModal({ onClose, onChanged }) {
  const [products,setProducts]=useState([]); const [orders,setOrders]=useState([]); const [form,setForm]=useState(blank); const [message,setMessage]=useState("");
  async function load(){ const [p,o]=await Promise.all([api("/products"),api("/orders/admin")]); setProducts(p.products||[]); setOrders(o.orders||[]); }
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
  async function add(e){e.preventDefault();setMessage("");try{await api("/products",{method:"POST",body:JSON.stringify({...form,price:Number(form.price)})});setForm(blank);await load();onChanged();setMessage("Product added.");}catch(e){setMessage(e.message);}}
  async function remove(id){if(!confirm("Remove this product from the catalogue?"))return;try{await api(`/products/${id}`,{method:"DELETE"});await load();onChanged();}catch(e){setMessage(e.message);}}
  async function status(id,status){try{await api(`/orders/admin/${id}/status`,{method:"PATCH",body:JSON.stringify({status})});await load();}catch(e){setMessage(e.message);}}
  return <Modal title="Admin dashboard" onClose={onClose} wide>
    <p className="admin-note">Catalogue and order management. Keep product prices in euros.</p>
    <h3 className="section-mini-title">Add a product</h3>
    <form className="admin-form" onSubmit={add}>
      <input aria-label="Product name" placeholder="Product name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
      <input aria-label="Description" placeholder="Short description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/>
      <input aria-label="Price" placeholder="Price (€)" type="number" min="0.01" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/>
      <select aria-label="Category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{["Phones","Headphones","Buds","Watches"].map(c=><option key={c}>{c}</option>)}</select>
      <input aria-label="Image URL" placeholder="Image URL (optional)" value={form.image} onChange={e=>setForm({...form,image:e.target.value})}/>
      <button className="button button-dark">Add product</button>
    </form>
    {message && <p className={message.includes("added")?"form-success":"form-error"}>{message}</p>}
    <h3 className="section-mini-title">Catalogue ({products.length})</h3>
    <div className="admin-table">{products.map(p=><div className="admin-row" key={p.id}><span>{p.name}<small>{p.category} · €{Number(p.price).toFixed(2)}</small></span><button className="button button-outline button-small" onClick={()=>remove(p.id)}>Remove</button></div>)}</div>
    <h3 className="section-mini-title">Orders ({orders.length})</h3>
    <div className="admin-table">{orders.length===0?<p className="fine-print">No orders placed yet.</p>:orders.map(o=><div className="admin-row" key={o.id}><span>#{o.id} · {o.customerName}<small>€{Number(o.total).toFixed(2)} · {o.customerEmail}</small></span><select value={o.status} onChange={e=>status(o.id,e.target.value)} aria-label={`Status for order ${o.id}`}>{["pending","shipped","completed","cancelled"].map(s=><option key={s}>{s}</option>)}</select></div>)}</div>
  </Modal>;
}
