import { Router } from "express";
import * as festivalController from "../controllers/festival-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { requireJudge } from "../middleware/festival-judge";

const router = Router();

// Экран показа. Публичный и только на чтение: адрес раздаётся организаторам,
// секрета в нём нет, повлиять на результат отсюда нельзя — писать некуда.
router.get("/board/:slug", festivalController.board);

// Судья: вход по PIN, дальше — только свой участник.
router.post("/judge/login", festivalController.judgeLogin);
router.get("/judge/me", requireJudge, festivalController.judgeMe);
router.post("/judge/mark", requireJudge, festivalController.judgeMark);
router.delete("/judge/events/last", requireJudge, festivalController.judgeUndo);
router.post("/judge/points", requireJudge, festivalController.judgeAddPoints);
router.post("/judge/penalties", requireJudge, festivalController.judgeAddPenalty);
router.delete(
  "/judge/penalties/last",
  requireJudge,
  festivalController.judgeUndoPenalty,
);
router.delete(
  "/judge/points/:rowId",
  requireJudge,
  festivalController.judgeDeletePoint,
);

// Подготовка гонки и правки постфактум — под обычным админом искр.
const admin = [requireAuth, requireAdmin];

router.get("/races", ...admin, festivalController.listRaces);
router.post("/races", ...admin, festivalController.createRace);
router.get("/races/:id", ...admin, festivalController.adminBoard);
router.delete("/races/:id", ...admin, festivalController.deleteRace);
router.put("/races/:id/stations", ...admin, festivalController.setStations);
router.put("/races/:id/roster", ...admin, festivalController.setRoster);
router.post("/races/:id/start", ...admin, festivalController.startRace);
router.post("/races/:id/finish", ...admin, festivalController.finishRace);
router.post("/races/:id/reset", ...admin, festivalController.resetRace);
router.delete("/events/:rowId", ...admin, festivalController.deleteEvent);
router.delete("/points/:rowId", ...admin, festivalController.deletePoint);
router.delete("/penalties/:rowId", ...admin, festivalController.deletePenalty);

export default router;
