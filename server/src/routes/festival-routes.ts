import { Router } from "express";
import * as festivalController from "../controllers/festival-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { requireJudge } from "../middleware/festival-judge";

const router = Router();

// Экран показа. Публичный и только на чтение: адрес раздаётся организаторам,
// секрета в нём нет, повлиять на результат отсюда нельзя — писать некуда.
router.get("/board/:slug", festivalController.board);

// Финальное голосование зала: бюллетень и голос. Тоже публичные — зритель
// приходит по QR с экрана, никакого входа у него нет.
router.get("/vote/:slug", festivalController.ballot);
router.post("/vote/:slug", festivalController.vote);

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
router.put("/judge/color", requireJudge, festivalController.judgeSetColor);
router.get("/judge/votes", requireJudge, festivalController.judgeVotes);

// Подготовка гонки и правки постфактум — под обычным админом искр.
const admin = [requireAuth, requireAdmin];

router.get("/races", ...admin, festivalController.listRaces);
router.post("/races", ...admin, festivalController.createRace);
router.get("/races/:id", ...admin, festivalController.adminBoard);
router.delete("/races/:id", ...admin, festivalController.deleteRace);
router.put("/races/:id/settings", ...admin, festivalController.updateRace);
router.put("/races/:id/stations", ...admin, festivalController.setStations);
router.put("/races/:id/roster", ...admin, festivalController.setRoster);
router.post("/races/:id/start", ...admin, festivalController.startRace);
router.post("/races/:id/finish", ...admin, festivalController.finishRace);
router.post("/races/:id/reset", ...admin, festivalController.resetRace);
router.delete("/events/:rowId", ...admin, festivalController.deleteEvent);
router.delete("/points/:rowId", ...admin, festivalController.deletePoint);
router.delete("/penalties/:rowId", ...admin, festivalController.deletePenalty);

// Правка результатов конкретного участника — админ действует как его судья.
router.post("/participants/:rowId/mark", ...admin, festivalController.adminMark);
router.delete(
  "/participants/:rowId/events/last",
  ...admin,
  festivalController.adminUndoEvent,
);
router.post(
  "/participants/:rowId/penalties",
  ...admin,
  festivalController.adminAddPenalty,
);
router.delete(
  "/participants/:rowId/penalties/last",
  ...admin,
  festivalController.adminUndoPenalty,
);
router.post(
  "/participants/:rowId/points",
  ...admin,
  festivalController.adminAddPoints,
);
router.put("/participants/:rowId/color", ...admin, festivalController.setColor);

// Голосование: состав финала, приём голосов и обнуление счёта.
router.put("/races/:id/finalists", ...admin, festivalController.setFinalists);
router.put("/races/:id/voting", ...admin, festivalController.setVoting);
router.delete("/races/:id/votes", ...admin, festivalController.clearVotes);

export default router;
