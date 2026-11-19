import { query } from "../database/db.js";
import { ErpUnavailableError, UserError } from "../utils/errors.js";
import { CATEGORIES as categories, cleanText, positiveId, positivePrice } from "../validators/common.js";
import { createErpProduct, getErpProducts } from "./erpClient.js";
import { availabilityOf, erpProductIdFor } from "./erpMapping.js";
// Lab 3: stock lives only in the ERP. products.stock still exists in the shared database but is never read or written.
const productColumns =
  "id, erp_product_id, name, description, price, category, image, active";
// Adds the ERP's live stock and price to shop rows. erpProducts === null means the ERP could not be asked.
export function withLiveStock(rows, erpProducts) {
  const byId = new Map((erpProducts || []).map(p => [p.productId, p]));
  return rows.map(row => {
    if (!row.erp_product_id) return {...row, stock: null, availability: "not_sold"};
    if (erpProducts === null) return {...row, stock: null, availability: "unknown"};
    const erp = byId.get(row.erp_product_id);
    return erp ? {...row, price: erp.price, stock: erp.stock, availability: availabilityOf(erp.stock, true)} : {...row, stock: null, availability: "not_sold"};
  });
}
// One ERP call per catalogue request, no cache: the shop never shows stock that did not just come from the ERP.
export async function listProducts() {
  const {rows}=await query(`SELECT ${productColumns} FROM products WHERE active ORDER BY id`);
  let erpProducts=null;
  try{erpProducts=await getErpProducts();}catch(e){if(!(e instanceof ErpUnavailableError))throw e;}
  return {products:withLiveStock(rows,erpProducts),erpAvailable:erpProducts!==null};
}
// Live stock for one product, asked whenever a customer opens the product view.
export async function productStock(id) {
  const {rows:[row]}=await query(`SELECT ${productColumns} FROM products WHERE id = $1 AND active`,[positiveId(id)]);
  if(!row)throw new UserError("Product not found.",404);
  const [product]=withLiveStock([row],row.erp_product_id?await getErpProducts():[]);
  return {stock:product.stock,availability:product.availability,price:product.price};
}
// Lab 1 "add products" with Lab 3's rule: the ERP owns stock, so the product is created there first.
export async function createProduct(body) {
  const name=cleanText(body.name,100), description=cleanText(body.description,500);
  const category=cleanText(body.category,40), price=positivePrice(body.price);
  if(!name || !description || !categories.includes(category) || price===null) throw new UserError("Provide a name, description, valid price and supported category.");
  const initialStock=body.initialStock===undefined||body.initialStock===""?0:Number(body.initialStock);
  if(!Number.isInteger(initialStock)||initialStock<0||initialStock>1000)throw new UserError("Initial stock must be a whole number from 0 to 1000.");
  const image=cleanText(body.image,1000)||`https://placehold.co/700x600/e5e5df/242520?text=${encodeURIComponent(name)}`;
  const taken=new Set([...(await getErpProducts()).map(p=>p.productId),...(await query("SELECT erp_product_id FROM products WHERE erp_product_id IS NOT NULL")).rows.map(r=>r.erp_product_id)]);
  const erpProductId=erpProductIdFor(name,taken);
  await createErpProduct({productId:erpProductId,name,description,price,stock:initialStock});
  const {rows:[product]}=await query(`INSERT INTO products (erp_product_id, name, description, category, price, image) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${productColumns}`,[erpProductId,name,description,category,price,image]);
  return {...product,stock:initialStock,availability:availabilityOf(initialStock,true)};
}
export async function deactivateProduct(id) {
  const {rows:[product]}=await query(`UPDATE products SET active = FALSE, removed_by_admin = TRUE WHERE id = $1 AND active RETURNING ${productColumns}`,[positiveId(id)]);
  if(!product)throw new UserError("Product not found.");
  return product;
}
