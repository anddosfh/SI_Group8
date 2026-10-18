import { Router } from "express";
import { loginHandler, meHandler, registerHandler, updateMeHandler } from "../controllers/authController.js";
import { authRequired } from "../middleware/auth.js";
const router=Router();
router.post("/register",registerHandler);
router.post("/login",loginHandler);
router.get("/me",authRequired,meHandler);
router.put("/me",authRequired,updateMeHandler);
export default router;
