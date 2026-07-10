import { Router } from "express";
import * as shiftsController from "../controllers/shifts-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", shiftsController.list);
router.get("/winners", shiftsController.winners);
router.get("/people-of-day", shiftsController.peopleOfDay);
router.get("/:id", shiftsController.detail);
router.patch("/:id", shiftsController.updateMeta);
router.post("/:id/members", shiftsController.addMembers);
router.get("/:id/achievements", shiftsController.achievements);
router.put("/:id/achievements", shiftsController.saveAchievements);

export default router;
