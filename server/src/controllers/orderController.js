import { allOrders, createOrder, ordersForUser, updateOrderStatus } from "../services/orderService.js";
import { sendError } from "../utils/errors.js";
export async function placeOrder(req,res,next){try{res.status(201).json({order:await createOrder(req.user.id,req.body.items,req.body.address)});}catch(e){sendError(res,next,400,e);}}
export async function myOrders(req,res,next){try{res.json({orders:await ordersForUser(req.user.id)});}catch(e){next(e);}}
export async function adminOrders(req,res,next){try{res.json({orders:await allOrders()});}catch(e){next(e);}}
export async function changeStatus(req,res,next){try{res.json({order:await updateOrderStatus(req.params.id,req.body.status)});}catch(e){sendError(res,next,400,e);}}
