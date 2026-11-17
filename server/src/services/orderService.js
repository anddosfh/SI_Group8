import { query } from "../database/db.js";
import { ErpUnavailableError, UserError } from "../utils/errors.js";
import { cleanText, positiveId } from "../validators/common.js";
import { createErpCustomer, getErpCustomers, getErpOrders, getErpProducts, placeErpOrder, runErpOrderAction, sameEmail, updateErpCustomerStreet } from "./erpClient.js";
import { STATUS_ACTIONS, nextStatuses, readableErpMessage, toShopOrder } from "./erpMapping.js";
// Lab 3: purchase orders live only in the Mini-ERP. The shop creates them by RPC, reads them back for the order history
// and the admin dashboard, and changes their status through the ERP's actions. The old orders/order_items tables are
// no longer read or written (they stay in the shared database as an archive of the orders placed before Lab 3).
const checkoutsRunning=new Set();
const cents=v=>Math.round(Number(v)*100);
const round2=v=>cents(v)/100;
const money=v=>`€${Number(v).toFixed(2)}`;
const today=()=>new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time
const lookups=(products,customers)=>({productsByUuid:new Map(products.map(p=>[p.uuid,p])),customersById:new Map(customers.map(c=>[c.id,c]))});
// Checkout without the shop database: user {id, name, email}, items [{productId, quantity, unitPrice?}], shopProducts = active rows.
export async function checkout({user,address,items,shopProducts}){
  if(!Array.isArray(items)||items.length===0)throw new UserError("Your bag is empty.");
  // One checkout per user at a time: a double click or a second tab must not create a second order.
  if(checkoutsRunning.has(user.id))throw new UserError("Your previous order is still being processed.",409);
  checkoutsRunning.add(user.id);
  try{
    const lines=[];
    for(const item of items){
      const id=positiveId(item?.productId), quantity=Number(item?.quantity);
      const product=shopProducts.find(p=>p.id===id&&p.active!==false);
      if(!product||!Number.isInteger(quantity)||quantity<1||quantity>50)throw new UserError("One of the selected products or quantities is invalid.");
      if(!product.erp_product_id)throw new UserError(`${product.name} cannot be ordered because the ERP does not manage it.`,409);
      const unitPrice=item.unitPrice===undefined||item.unitPrice===null?null:Number(item.unitPrice);
      const existing=lines.find(l=>l.product.id===id);
      if(existing){existing.quantity+=quantity;if(existing.unitPrice===null)existing.unitPrice=unitPrice;}else lines.push({product,quantity,unitPrice});
    }
    // Real-time stock query when the customer attempts to order. The ERP checks again when it stores the order.
    const erpProducts=await getErpProducts();
    const byProductId=new Map(erpProducts.map(p=>[p.productId,p]));
    for(const l of lines){
      const erp=byProductId.get(l.product.erp_product_id);
      if(!erp)throw new UserError(`${l.product.name} is no longer available.`,409);
      if(l.unitPrice!==null&&cents(l.unitPrice)!==cents(erp.price))throw new UserError(`The price of ${l.product.name} changed to ${money(erp.price)}. Please review your bag.`,409);
      if(erp.stock<l.quantity)throw new UserError(erp.stock<=0?`${l.product.name} is out of stock.`:`Only ${erp.stock} × ${l.product.name} in stock.`,409);
      l.erp=erp;
    }
    // The ERP needs a customer. It is found by email (no ERP id is stored in the shop, so an ERP restart does no harm).
    const street=cleanText(address,300);
    const customer=(await getErpCustomers()).find(c=>sameEmail(c.email,user.email));
    let customerId=customer?.id;
    if(!customer)customerId=await createErpCustomer({name:user.name,email:user.email,street});
    else if(street&&customer.street!==street)await updateErpCustomerStreet(customer.id,street);
    // Prices come from the ERP, which is the source of truth; currency is the ERP's (EUR).
    const orderItems=lines.map(l=>({productUuid:l.erp.uuid,quantity:l.quantity,itemAmount:round2(l.erp.price*l.quantity)}));
    const orderAmount=round2(orderItems.reduce((sum,i)=>sum+i.itemAmount,0));
    const order={customerId,orderDate:today(),orderAmount,currency:lines[0].erp.currency||"EUR",items:orderItems};
    let orderId;
    try{orderId=await placeErpOrder(order);}
    catch(e){if(e instanceof UserError)throw new UserError(readableErpMessage(e.message,new Map(lines.map(l=>[l.product.erp_product_id,l.product.name]))),e.status);throw e;}
    return toShopOrder({...order,orderId,status:"new"},lookups(erpProducts,[{id:customerId,name:user.name,email:user.email,street}]));
  }finally{checkoutsRunning.delete(user.id);}
}
export async function createOrder(userId,items,address){
  const {rows:[user]}=await query("SELECT id, name, email, address FROM users WHERE id = $1",[userId]);
  const ids=(Array.isArray(items)?items:[]).map(i=>positiveId(i?.productId)).filter(Boolean);
  const {rows:shopProducts}=await query("SELECT id, name, erp_product_id, active FROM products WHERE id = ANY($1::int[]) AND active",[ids]);
  const newAddress=cleanText(address,300);
  const order=await checkout({user,address:newAddress||user.address||"",items,shopProducts});
  if(newAddress)await query("UPDATE users SET address = $1 WHERE id = $2",[newAddress,userId]);
  return order;
}
// All ERP orders of the ERP customer(s) with this email, newest first, in the shop's order shape.
export async function erpOrdersForEmail(email){
  const [orders,customers,products]=await Promise.all([getErpOrders(),getErpCustomers(),getErpProducts()]);
  const ids=new Set(customers.filter(c=>sameEmail(c.email,email)).map(c=>c.id));
  return orders.filter(o=>ids.has(o.customerId)).sort((a,b)=>b.orderId-a.orderId).map(o=>toShopOrder(o,lookups(products,customers)));
}
// Lab 1 "purchase history" on the customer: the ERP order numbers. Empty when the ERP is down, so login never fails.
export async function orderIdsForEmail(email){
  try{
    const [orders,customers]=await Promise.all([getErpOrders(),getErpCustomers()]);
    const ids=new Set(customers.filter(c=>sameEmail(c.email,email)).map(c=>c.id));
    return orders.filter(o=>ids.has(o.customerId)).map(o=>o.orderId).sort((a,b)=>a-b);
  }catch(e){if(e instanceof ErpUnavailableError)return [];throw e;}
}
export async function ordersForUser(userId){
  const {rows:[user]}=await query("SELECT email FROM users WHERE id = $1",[userId]);
  return user?erpOrdersForEmail(user.email):[];
}
export async function allOrders(){
  const [orders,customers,products]=await Promise.all([getErpOrders(),getErpCustomers(),getErpProducts()]);
  return orders.sort((a,b)=>b.orderId-a.orderId).map(o=>toShopOrder(o,lookups(products,customers)));
}
// The ERP stores the status; the admin dashboard triggers the ERP's action for the next allowed status.
export async function updateOrderStatus(orderId,status){
  const id=positiveId(orderId);
  const order=id&&(await getErpOrders()).find(o=>o.orderId===id);
  if(!order)throw new UserError("Order not found.",404);
  if(!nextStatuses(order.status).includes(status))throw new UserError(`Cannot change an order from ${order.status} to ${status}.`,409);
  await runErpOrderAction(id,STATUS_ACTIONS[status]);
  const [orders,customers,products]=await Promise.all([getErpOrders(),getErpCustomers(),getErpProducts()]);
  return toShopOrder(orders.find(o=>o.orderId===id),lookups(products,customers));
}
