import { Router } from "express";
import * as settingsController from "../controllers/settings-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

// Без авторизации: страница входа тоже должна знать про праздник, а секрета в
// флаге нет.
router.get("/festive", settingsController.festive);

// Легенда каталога — единственное про цены, что видит ребёнок: сколько искр за
// что дают на его смене. Без `requireAdmin`, но с авторизацией: наружу цены не
// торчат.
router.get("/legend", requireAuth, settingsController.legend);

router.get("/", requireAuth, requireAdmin, settingsController.list);
router.get(
  "/price-window",
  requireAuth,
  requireAdmin,
  settingsController.priceWindow,
);
// Цена задаётся версией «с такой-то даты» — правки задним числом нет by design.
router.put(
  "/:id/prices",
  requireAuth,
  requireAdmin,
  settingsController.setPrice,
);
router.delete(
  "/:id/prices/:validFrom",
  requireAuth,
  requireAdmin,
  settingsController.deletePrice,
);

export default router;
