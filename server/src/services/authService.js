import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { query } from "../database/db.js";
import { UserError } from "../utils/errors.js";
import { cleanText, validEmail } from "../validators/common.js";

// The public user shape the API returns; password hashes are only ever selected in login().
const userColumns = `u.id, u.name, u.email, u.address, u.role,
  ARRAY(SELECT o.id FROM orders o WHERE o.user_id = u.id ORDER BY o.id) AS "purchaseHistory"`;

function session(user) {
  return {token:jwt.sign({id:user.id},JWT_SECRET,{expiresIn:"7d"}),user};
}
export async function findUser(id) {
  const {rows:[user]} = await query(`SELECT ${userColumns} FROM users u WHERE u.id = $1`, [id]);
  return user || null;
}
export async function register({name,email,password,address}) {
  name = cleanText(name,100); email = cleanText(email,160).toLowerCase(); address = cleanText(address,300);
  if (name.length < 2) throw new UserError("Please enter your full name.");
  if (!validEmail(email)) throw new UserError("Please enter a valid email address.");
  if (typeof password !== "string" || password.length < 8) throw new UserError("Password must contain at least 8 characters.");
  const {rows:[created]} = await query(
    "INSERT INTO users (name, email, address, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id",
    [name, email, address, await bcrypt.hash(password,10)]);
  if (!created) throw new UserError("An account with this email already exists.");
  return session(await findUser(created.id));
}
export async function login({email,password}) {
  const normalized = cleanText(email,160).toLowerCase();
  const {rows:[row]} = await query(`SELECT ${userColumns}, u.password_hash AS "passwordHash" FROM users u WHERE u.email = $1`, [normalized]);
  if (!row || !await bcrypt.compare(String(password || ""),row.passwordHash)) throw new UserError("Email or password is incorrect.");
  const {passwordHash, ...user} = row;
  return session(user);
}
export async function updateProfile(userId, body) {
  let name = null, address = null;
  if (body.name !== undefined) { name = cleanText(body.name,100); if (name.length < 2) throw new UserError("Name must contain at least 2 characters."); }
  if (body.address !== undefined) address = cleanText(body.address,300);
  await query("UPDATE users SET name = COALESCE($1, name), address = COALESCE($2, address) WHERE id = $3", [name, address, userId]);
  return findUser(userId);
}
