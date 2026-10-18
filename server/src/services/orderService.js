import { query, withTransaction } from "../database/db.js";
import { UserError } from "../utils/errors.js";
import { cleanText, positiveId } from "../validators/common.js";
const statuses=["pending","shipped","completed","cancelled"];
// Builds the same order shape the API has always returned, with the line items nested as JSON.
const orderSelect=`SELECT o.id, o.user_id AS "userId", o.customer_name AS "customerName", o.customer_email AS "customerEmail",
  o.address, o.total, o.status, o.created_at AS "createdAt",
  (SELECT COALESCE(json_agg(json_build_object('productId', i.product_id, 'name', i.name, 'unitPrice', i.unit_price, 'quantity', i.quantity) ORDER BY i.id), '[]')
     FROM order_items i WHERE i.order_id = o.id) AS items
  FROM orders o`;
export async function createOrder(userId, items, address) {
  if(!Array.isArray(items)||items.length===0)throw new UserError("Your bag is empty.");
  return withTransaction(async client=>{
    const {rows:[user]}=await client.query("SELECT name, email, address FROM users WHERE id = $1",[userId]);
    const ids=items.map(item=>positiveId(item?.productId));
    const {rows:products}=await client.query("SELECT id, name, price FROM products WHERE id = ANY($1::int[]) AND active",[ids.filter(Boolean)]);
    const normalized=[];
    for(const [index,item] of items.entries()){
      const product=products.find(p=>p.id===ids[index]);
      const quantity=Number(item?.quantity);
      if(!product||!Number.isInteger(quantity)||quantity<1||quantity>50)throw new UserError("One of the selected products or quantities is invalid.");
      const existing=normalized.find(i=>i.productId===product.id);
      if(existing)existing.quantity+=quantity;else normalized.push({productId:product.id,name:product.name,unitPrice:product.price,quantity});
    }
    const total=Math.round(normalized.reduce((sum,i)=>sum+i.unitPrice*i.quantity,0)*100)/100;
    const {rows:[{id}]}=await client.query("INSERT INTO orders (user_id, customer_name, customer_email, address, total) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [userId,user.name,user.email,cleanText(address,300)||user.address||"",total]);
    for(const i of normalized)await client.query("INSERT INTO order_items (order_id, product_id, name, unit_price, quantity) VALUES ($1, $2, $3, $4, $5)",[id,i.productId,i.name,i.unitPrice,i.quantity]);
    if(address)await client.query("UPDATE users SET address = $1 WHERE id = $2",[cleanText(address,300),userId]);
    return (await client.query(`${orderSelect} WHERE o.id = $1`,[id])).rows[0];
  });
}
export async function ordersForUser(userId){return (await query(`${orderSelect} WHERE o.user_id = $1 ORDER BY o.id DESC`,[userId])).rows;}
export async function allOrders(){return (await query(`${orderSelect} ORDER BY o.id DESC`)).rows;}
export async function updateOrderStatus(id,status){
  if(!statuses.includes(status))throw new UserError("Invalid order status.");
  const {rows:[order]}=await query("UPDATE orders SET status = $1 WHERE id = $2 RETURNING id",[status,positiveId(id)]);
  if(!order)throw new UserError("Order not found.");
  return (await query(`${orderSelect} WHERE o.id = $1`,[order.id])).rows[0];
}
