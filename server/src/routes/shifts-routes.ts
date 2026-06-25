import { Router } from "express";
import * as shiftsController from "../controllers/shifts-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", shiftsController.list);
router.get("/:id", shiftsController.detail);

export default router;
