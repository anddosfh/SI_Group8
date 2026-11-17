import { createContext, useContext, useMemo, useState } from "react";
const StoreContext = createContext(null);
export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);
  const addToCart = (product) => setCart(old => {
    const found = old.find(item => item.id === product.id);
    return found ? old.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...old, { ...product, quantity: 1 }];
  });
  const updateQuantity = (id, quantity) => setCart(old => quantity <= 0 ? old.filter(i => i.id !== id) : old.map(i => i.id === id ? { ...i, quantity } : i));
  const removeFromCart = (id) => setCart(old => old.filter(i => i.id !== id));
  const clearCart = () => setCart([]);
  // Lab 3: takes over the latest ERP price, stock and availability for the products in the bag.
  const syncCart = (products) => setCart(old => old.map(item => { const fresh = products.find(p => p.id === item.id); return fresh ? { ...item, price: fresh.price, stock: fresh.stock, availability: fresh.availability } : item; }));
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  return <StoreContext.Provider value={{ cart, addToCart, updateQuantity, removeFromCart, clearCart, syncCart, total }}>{children}</StoreContext.Provider>;
}
export const useStore = () => useContext(StoreContext);
