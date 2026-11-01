import { Router } from "express";
import * as analyticsController from "../controllers/analytics-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

// Аналитика — админская: она вся про то, как устроена выдача наград.
router.get("/rewards", requireAuth, requireAdmin, analyticsController.rewards);
router.get(
  "/trajectories",
  requireAuth,
  requireAdmin,
  analyticsController.trajectories,
);

export default router;
