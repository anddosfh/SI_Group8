import { Search, ShoppingBag, UserRound, X, Menu } from "lucide-react";
import { useState } from "react";
const categories = ["All Products", "Phones", "Headphones", "Buds", "Watches"];
export default function Header({ category, setCategory, query, setQuery, cartCount, onCart, onAccount, user, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <header className="site-header">
    <div className="topline"><span>TECHNOLOGY, CONSIDERED.</span><span>DESIGNED FOR EVERY DAY · EU SHIPPING</span></div>
    <div className="nav-main">
      <button className="icon-button mobile-menu" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu"><Menu /></button>
      <a className="wordmark" href="#" onClick={e => { e.preventDefault(); setCategory("All Products"); window.scrollTo({top:0,behavior:"smooth"}); }}>NOVA<span>®</span></a>
      <nav className={mobileOpen ? "category-nav open" : "category-nav"}>
        {categories.map(c => <button key={c} className={category === c ? "nav-link active" : "nav-link"} onClick={() => { setCategory(c); setMobileOpen(false); document.getElementById("catalogue")?.scrollIntoView({behavior:"smooth"}); }}>{c}</button>)}
      </nav>
      <div className="nav-actions">
        <label className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products" aria-label="Search products"/>{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={15}/></button>}</label>
        <button className="icon-button account-button" onClick={onAccount} aria-label="Account"><UserRound size={19}/><span>{user ? user.name.split(" ")[0] : "Account"}</span></button>
        {user && <button className="text-button" onClick={onLogout}>Sign out</button>}
        <button className="icon-button bag-button" onClick={onCart} aria-label="Shopping bag"><ShoppingBag size={19}/><span>Bag ({cartCount})</span></button>
      </div>
    </div>
  </header>;
}
