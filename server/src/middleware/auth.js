import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { findUser } from "../services/authService.js";

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({error:"Please sign in to continue."});
  let payload, user;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({error:"Your session has expired. Please sign in again."});
  }
  try {
    user = await findUser(payload.id);
  } catch (error) {
    return next(error);
  }
  if (!user) return res.status(401).json({error:"Account not found. Please sign in again."});
  req.user = user;
  next();
}
export function adminRequired(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({error:"Administrator access required."});
  next();
}
