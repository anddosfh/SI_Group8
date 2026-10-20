import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Check, ShieldCheck, Truck, Headphones } from "lucide-react";
import Header from "./components/Header";
import ProductCard from "./components/ProductCard";
import AccountModal from "./pages/AccountModal";
import CartModal from "./pages/CartModal";
import CheckoutModal from "./pages/CheckoutModal";
import OrdersModal from "./pages/OrdersModal";
import AdminModal from "./pages/AdminModal";
import { StoreProvider, useStore } from "./context/StoreContext";
import { api, clearSession, getSavedUser, getToken, setSession } from "./services/api";

function StoreApp() {
  const store = useStore();
  const [products,setProducts] = useState([]);
  const [category,setCategory] = useState("All Products");
  const [query,setQuery] = useState("");
  const [user,setUser] = useState(getSavedUser);
  const [modal,setModal] = useState("");
  const [selected,setSelected] = useState(null);
  const [notice,setNotice] = useState("");
  const [loadError,setLoadError] = useState("");
  async function loadProducts(){try{const r=await api("/products");setProducts(r.products||[]);setLoadError("");}catch(e){setLoadError(e.message);}}
  useEffect(()=>{loadProducts();},[]);
  const filtered = useMemo(()=>products.filter(p=>(category==="All Products"||p.category===category)&&`${p.name} ${p.description} ${p.category}`.toLowerCase().includes(query.toLowerCase())),[products,category,query]);
  const add = p => {store.addToCart(p);setNotice(`${p.name} added to your bag`);setTimeout(()=>setNotice(""),2400);};
  const logout = () => {clearSession();setUser(null);setNotice("You have signed out.");setTimeout(()=>setNotice(""),2200);};
  async function placeOrder(address){
    if(!user){setModal("account");throw new Error("Please sign in before placing an order.");}
    if(!store.cart.length)throw new Error("Your bag is empty.");
    const result=await api("/orders",{method:"POST",body:JSON.stringify({items:store.cart.map(i=>({productId:i.id,quantity:i.quantity})),address})});
    store.clearCart();setModal("");setNotice(`Order #${result.order.id} placed successfully`);setTimeout(()=>setNotice(""),4000);
    // The server saves the delivery address and purchase history with the order; reload the account so the UI shows them.
    // The order already succeeded, so a failed reload only leaves the old account data on screen.
    try{const me=await api("/auth/me");setSession(getToken(),me.user);setUser(me.user);}catch{}
  }
  return <div className="app-shell">
    <Header category={category} setCategory={setCategory} query={query} setQuery={setQuery} cartCount={store.cart.reduce((n,i)=>n+i.quantity,0)} onCart={()=>setModal("cart")} onAccount={()=>setModal("account")} user={user} onLogout={logout}/>
    <main>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-dot"/> THE NOVA COLLECTION · 2026</p><h1>Better tech.<br/><span>Less noise.</span></h1><p className="hero-description">Thoughtful technology for the way you live, work and move. Nothing unnecessary. Just the essentials, reimagined.</p><div className="hero-actions"><button className="button button-dark" onClick={()=>document.getElementById("catalogue").scrollIntoView({behavior:"smooth"})}>Explore the collection <ArrowRight size={17}/></button><span className="hero-count">01 — {products.length} PRODUCTS</span></div><div className="hero-footnote"><span>DESIGNED WITH INTENTION</span><span>BUILT FOR EVERY DAY</span></div></div>
        <div className="hero-art" aria-label="NOVA phone product illustration"><div className="art-grid"></div><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="phone-render"><div className="phone-side"></div><div className="phone-camera camera-one"></div><div className="phone-camera camera-two"></div><div className="phone-flash"></div><div className="phone-logo">N</div><div className="phone-mark">NOVA / 01</div></div><div className="art-label label-top">N—01 / OBJECTS</div><div className="art-label label-bottom">FORM FOLLOWS FUNCTION <span>↗</span></div><div className="art-stamp">N<br/><small>®</small></div></div>
      </section>
      <section className="benefits-strip"><div><Truck/><span><strong>Delivery across Europe</strong><small>Tracked, reliable shipping</small></span></div><div><ShieldCheck/><span><strong>Two-year warranty</strong><small>Confidence in every product</small></span></div><div><Headphones/><span><strong>Here when you need us</strong><small>Customer support that listens</small></span></div></section>
      <section className="catalogue-section" id="catalogue">
        <div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>{category === "All Products" ? "Everyday, upgraded." : `${category}, reimagined.`}</h2><p className="section-description">A considered collection of connected essentials.</p></div><div className="catalogue-meta"><span>{filtered.length.toString().padStart(2,"0")} PRODUCTS</span><span>EUROPE · EUR</span></div></div>
        <div className="filter-row">{["All Products","Phones","Headphones","Buds","Watches"].map(c=><button key={c} onClick={()=>setCategory(c)} className={category===c?"filter-chip selected":"filter-chip"}>{c}{c==="All Products"&&<span>{products.length}</span>}</button>)}</div>
        {loadError && <div className="error-banner"><strong>Can't reach the catalogue API.</strong><span>{loadError}. Start the server in the server folder.</span></div>}
        {filtered.length ? <div className="product-grid">{filtered.map(p=><ProductCard key={p.id} product={p} onAdd={add} onDetails={setSelected}/>)}</div> : <div className="empty-catalogue"><h3>No products found</h3><p>Try another category or search term.</p><button className="button button-outline" onClick={()=>{setCategory("All Products");setQuery("");}}>Show all products</button></div>}
        <div className="catalogue-bottom"><span>SHOWING {filtered.length} OF {products.length} OBJECTS</span><button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>BACK TO TOP <ArrowDown size={15} className="up-arrow"/></button></div>
      </section>
      <section className="manifesto"><div className="manifesto-symbol">N.</div><div><p className="eyebrow">THE NOVA POINT OF VIEW</p><h2>Technology should<br/>feel <em>effortless.</em></h2></div><p className="manifesto-copy">We believe the best technology doesn't ask for your attention. It earns its place in your life through clarity, usefulness and considered design.</p></section>
      <section className="newsletter"><div><p className="eyebrow">STAY IN THE LOOP</p><h2>Good things, occasionally.</h2><p>Product news and ideas worth opening. No noise.</p></div><form onSubmit={e=>{e.preventDefault();setNotice("Thanks — you're on the demo list.");setTimeout(()=>setNotice(""),3000);e.currentTarget.reset();}}><input type="email" required placeholder="Email address" aria-label="Email address"/><button aria-label="Subscribe"><ArrowRight/></button></form></section>
    </main>
    <footer className="site-footer"><a className="wordmark" href="#" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:"smooth"});}}>NOVA<span>®</span></a><span>TECHNOLOGY, CONSIDERED.</span><span>© 2026 NOVA GADGETS · STUDENT LAB PROJECT</span>{user?.role==="admin"&&<button className="admin-launch" onClick={()=>setModal("admin")}>Admin dashboard</button>}</footer>
    {notice&&<div className="toast"><Check size={17}/>{notice}</div>}
    {modal==="account"&&<AccountModal onClose={()=>setModal("")} user={user} setUser={setUser} onOrders={()=>setModal("orders")}/>}
    {modal==="cart"&&<CartModal cart={store.cart} total={store.total} updateQuantity={store.updateQuantity} removeFromCart={store.removeFromCart} onClose={()=>setModal("")} onCheckout={()=>{if(!user){setModal("account");return;}setModal("checkout");}}/>}
    {modal==="checkout"&&<CheckoutModal onClose={()=>setModal("")} total={store.total} user={user} onPlaceOrder={placeOrder}/>}
    {modal==="orders"&&<OrdersModal onClose={()=>setModal("")} user={user}/>}
    {modal==="admin"&&<AdminModal onClose={()=>setModal("")} onChanged={loadProducts}/>}
    {selected&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><section className="modal modal-wide product-detail"><button className="detail-close icon-button" onClick={()=>setSelected(null)}>×</button><img src={selected.image} alt={selected.name} onError={e=>e.currentTarget.src="https://placehold.co/600x500/f0f0ec/222?text=NOVA"}/><div><p className="product-category">{selected.category}</p><h2>{selected.name}</h2><p>{selected.description}</p><strong className="detail-price">€{Number(selected.price).toFixed(2)}</strong><button className="button button-dark button-full" onClick={()=>{add(selected);setSelected(null);}}>Add to bag <ArrowRight size={17}/></button><p className="fine-print">Designed for everyday use. Demo product information.</p></div></section></div>}
  </div>;
}
export default function App(){return <StoreProvider><StoreApp/></StoreProvider>;}
