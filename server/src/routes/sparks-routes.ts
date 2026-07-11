import { Router } from "express";
import * as sparksController from "../controllers/sparks-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

router.get("/me", requireAuth, sparksController.me);
router.get("/me/breakdown", requireAuth, sparksController.myBreakdown);
router.get("/ranking", requireAuth, requireAdmin, sparksController.ranking);
router.get("/overview", requireAuth, requireAdmin, sparksController.overview);
router.post("/lookup", requireAuth, requireAdmin, sparksController.lookup);

export default router;
