import { Router } from "express";
import * as childrenController from "../controllers/children-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", childrenController.list);
router.get("/overview", childrenController.overview);
router.post("/", childrenController.create);
router.post("/generate-passwords", childrenController.generatePasswords);
router.get("/:id/details", childrenController.getDetails);
router.put("/:id/details", childrenController.saveDetails);
router.patch("/:id/current-rating", childrenController.setCurrentRating);
router.patch("/:id", childrenController.update);
router.post("/:id/password", childrenController.setPassword);

export default router;
