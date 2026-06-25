import { Router } from "express";
import * as childrenController from "../controllers/children-controller";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", childrenController.list);
router.post("/", childrenController.create);
router.post("/generate-passwords", childrenController.generatePasswords);
router.patch("/:id", childrenController.update);
router.post("/:id/password", childrenController.setPassword);

export default router;
