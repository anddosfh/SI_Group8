import { query } from "../database/db.js";
import { UserError } from "../utils/errors.js";
import { cleanText, positiveId, positivePrice } from "../validators/common.js";
const categories = ["Phones","Headphones","Buds","Watches"];
const productColumns = "id, name, description, price, category, image, active";
export async function listProducts() {
  return (await query(`SELECT ${productColumns} FROM products WHERE active ORDER BY id`)).rows;
}
export async function createProduct(body) {
  const name=cleanText(body.name,120), description=cleanText(body.description,500);
  const category=cleanText(body.category,40), price=positivePrice(body.price);
  if(!name || !description || !categories.includes(category) || price===null) throw new UserError("Provide a name, description, valid price and supported category.");
  const image=cleanText(body.image,1000)||`https://placehold.co/700x600/e5e5df/242520?text=${encodeURIComponent(name)}`;
  const {rows:[product]}=await query(`INSERT INTO products (name, description, category, price, image) VALUES ($1, $2, $3, $4, $5) RETURNING ${productColumns}`,[name,description,category,price,image]);
  return product;
}
export async function deactivateProduct(id) {
  const {rows:[product]}=await query(`UPDATE products SET active = FALSE WHERE id = $1 AND active RETURNING ${productColumns}`,[positiveId(id)]);
  if(!product)throw new UserError("Product not found.");
  return product;
}
