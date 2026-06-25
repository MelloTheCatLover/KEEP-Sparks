import { Router } from "express";
import * as settingsController from "../controllers/settings-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

router.get("/", requireAuth, requireAdmin, settingsController.list);
router.patch("/:id", requireAuth, requireAdmin, settingsController.update);

export default router;
