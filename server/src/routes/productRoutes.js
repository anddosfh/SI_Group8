import { Router } from "express";
import { addProduct, getProducts, removeProduct } from "../controllers/productController.js";
import { adminRequired, authRequired } from "../middleware/auth.js";
const router=Router();
router.get("/",getProducts);
router.post("/",authRequired,adminRequired,addProduct);
router.delete("/:id",authRequired,adminRequired,removeProduct);
export default router;
