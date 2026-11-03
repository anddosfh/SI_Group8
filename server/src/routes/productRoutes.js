import { Router } from "express";
import {
  addProduct,
  getImports,
  getProducts,
  removeProduct,
  syncErpProducts,
  uploadProductFile
} from "../controllers/productController.js";
import { adminRequired, authRequired } from "../middleware/auth.js";

const router = Router();

router.get("/", getProducts);

router.post("/", authRequired, adminRequired, addProduct);

// Lab 2: ERP product import
router.post("/import", authRequired, adminRequired, uploadProductFile);
router.post("/import/erp", authRequired, adminRequired, syncErpProducts);
router.get("/imports", authRequired, adminRequired, getImports);

router.delete("/:id", authRequired, adminRequired, removeProduct);

export default router;
