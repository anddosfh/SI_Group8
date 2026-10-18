import { Router } from "express";
import { adminOrders, changeStatus, myOrders, placeOrder } from "../controllers/orderController.js";
import { adminRequired, authRequired } from "../middleware/auth.js";
const router=Router();
router.post("/",authRequired,placeOrder);
router.get("/mine",authRequired,myOrders);
router.get("/admin",authRequired,adminRequired,adminOrders);
router.patch("/admin/:id/status",authRequired,adminRequired,changeStatus);
export default router;
