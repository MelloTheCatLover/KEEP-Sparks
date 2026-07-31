import { Router } from "express";
import * as shiftsController from "../controllers/shifts-controller";
import * as liveController from "../controllers/live-controller";
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
router.post("/:id/roster/credentials", shiftsController.rosterCredentials);
router.get("/:id/achievements", shiftsController.achievements);
router.put("/:id/achievements", shiftsController.saveAchievements);

// Ведение смены по традициям: сырые факты, из которых достижения смены
// пересчитываются целиком после каждой правки.
router.get("/:id/live", liveController.board);
router.put("/:id/live/mode", liveController.setMode);
router.put("/:id/live/awards", liveController.saveAward);
router.put("/:id/live/teams", liveController.saveTeams);
router.put("/:id/live/stages", liveController.saveStages);
router.put("/:id/live/cups", liveController.saveCups);
router.put("/:id/live/winner", liveController.setWinner);
router.put("/:id/live/day", liveController.setDayReady);
// Кто и что получит за день — смотрят перед тем, как отдать искры.
router.get("/:id/live/days/:day", liveController.dayAwards);

// Подготовка составов КТБ: расчёт черновика (POST — тело со списком команд, но
// ничего не пишет) и час, в который дети узнают команду.
router.post("/:id/live/ktb/plan", liveController.ktbPlan);
router.put("/:id/live/ktb/reveal", liveController.setKtbReveal);

export default router;
