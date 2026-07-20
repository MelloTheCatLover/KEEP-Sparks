import { Router } from "express";
import * as shiftsController from "../controllers/shifts-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

// Read-only boards any signed-in user (incl. children) may view. No sensitive
// data — shift metadata, person of the shift, winners/finalists, people of day.
router.get("/", requireAuth, shiftsController.list);
router.get("/winners", requireAuth, shiftsController.winners);
router.get("/people-of-day", requireAuth, shiftsController.peopleOfDay);

// Everything below is admin-only (create / edit / per-shift detail).
router.use(requireAuth, requireAdmin);

router.get("/contests", shiftsController.contests);

router.post("/", shiftsController.create);
router.get("/:id", shiftsController.detail);
router.patch("/:id", shiftsController.updateMeta);
router.post("/:id/members", shiftsController.addMembers);
router.post("/:id/roster/sync", shiftsController.syncRoster);
router.post(
  "/:id/roster/reset-passwords",
  shiftsController.resetRosterPasswords,
);
router.get("/:id/achievements", shiftsController.achievements);
router.put("/:id/achievements", shiftsController.saveAchievements);

export default router;
