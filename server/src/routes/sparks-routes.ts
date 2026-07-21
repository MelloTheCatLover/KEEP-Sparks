import { Router } from "express";
import * as sparksController from "../controllers/sparks-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

router.get("/me", requireAuth, sparksController.me);
router.get("/me/breakdown", requireAuth, sparksController.myBreakdown);
router.post("/me/live/open", requireAuth, sparksController.openLiveDay);
router.get(
  "/child/:id/breakdown",
  requireAuth,
  requireAdmin,
  sparksController.childBreakdown,
);
// Manual bonus/penalty management (admin).
router.get(
  "/child/:id/adjustments",
  requireAuth,
  requireAdmin,
  sparksController.listAdjustments,
);
router.post(
  "/child/:id/adjustments",
  requireAuth,
  requireAdmin,
  sparksController.addAdjustment,
);
router.delete(
  "/adjustments/:adjId",
  requireAuth,
  requireAdmin,
  sparksController.deleteAdjustment,
);
// Public board every signed-in child can see (name + score, no login).
router.get("/board", requireAuth, sparksController.board);
router.get("/ranking", requireAuth, requireAdmin, sparksController.ranking);
router.get("/overview", requireAuth, requireAdmin, sparksController.overview);
router.post("/lookup", requireAuth, requireAdmin, sparksController.lookup);

export default router;
