import { Router } from "express";
import { adminAnalytics } from "../controllers/adminAnalyticsController.js";
import { authRequired, adminRequired } from "../middleware/auth.js";

const router = Router();

router.get("/admin", authRequired, adminRequired, adminAnalytics);

export default router;