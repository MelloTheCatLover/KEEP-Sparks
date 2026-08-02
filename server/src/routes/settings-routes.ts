import { Router } from "express";
import * as settingsController from "../controllers/settings-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

// Без авторизации: страница входа тоже должна знать про праздник, а секрета в
// флаге нет.
router.get("/festive", settingsController.festive);

router.get("/", requireAuth, requireAdmin, settingsController.list);
router.patch("/:id", requireAuth, requireAdmin, settingsController.update);

export default router;
