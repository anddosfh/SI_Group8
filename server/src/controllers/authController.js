import { findUser, login, register, updateProfile } from "../services/authService.js";
import { sendError } from "../utils/errors.js";
export async function registerHandler(req,res,next){try{res.status(201).json(await register(req.body));}catch(e){sendError(res,next,400,e);}}
export async function loginHandler(req,res,next){try{res.json(await login(req.body));}catch(e){sendError(res,next,401,e);}}
// The middleware loads the account without purchase history; /me adds it (from the ERP).
export async function meHandler(req,res,next){try{res.json({user:await findUser(req.user.id)});}catch(e){next(e);}}
export async function updateMeHandler(req,res,next){try{res.json({user:await updateProfile(req.user.id,req.body)});}catch(e){sendError(res,next,400,e);}}
