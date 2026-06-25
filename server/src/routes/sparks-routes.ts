import { Router } from "express";
import * as sparksController from "../controllers/sparks-controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/me", requireAuth, sparksController.me);

export default router;
