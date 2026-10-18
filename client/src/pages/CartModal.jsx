import { Minus, Plus, Trash2 } from "lucide-react";
import Modal from "../components/Modal";
export default function CartModal({ cart, total, updateQuantity, removeFromCart, onClose, onCheckout }) {
  return <Modal title={`Your bag (${cart.reduce((n,i)=>n+i.quantity,0)})`} onClose={onClose} wide>
    {cart.length === 0 ? <div className="empty-state"><div className="empty-icon">N</div><h3>Your bag is waiting</h3><p>Add something thoughtful to your everyday setup.</p><button className="button button-dark" onClick={onClose}>Continue shopping</button></div> :
    <><div className="cart-list">{cart.map(item => <div className="cart-row" key={item.id}>
      <img src={item.image} alt={item.name} onError={e=>e.currentTarget.src="https://placehold.co/120x100/f0f0ec/222?text=NOVA"}/>
      <div className="cart-product"><span className="product-category">{item.category}</span><h3>{item.name}</h3><strong>€{(item.price*item.quantity).toFixed(2)}</strong><div className="quantity-control"><button onClick={()=>updateQuantity(item.id,item.quantity-1)} aria-label="Decrease quantity"><Minus size={13}/></button><span>{item.quantity}</span><button onClick={()=>updateQuantity(item.id,item.quantity+1)} aria-label="Increase quantity"><Plus size={13}/></button></div></div>
      <button className="icon-button remove-button" onClick={()=>removeFromCart(item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={17}/></button>
    </div>)}</div>
    <div className="cart-summary"><div><span>Subtotal</span><strong>€{total.toFixed(2)}</strong></div><p>Shipping and taxes are calculated at checkout. Demo checkout does not process payment.</p><button className="button button-dark button-full" onClick={onCheckout}>Continue to checkout</button></div></>}
  </Modal>;
}
