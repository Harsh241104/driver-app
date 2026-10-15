import { Router } from "express";
import { createEarning, listEarnings } from "../controllers/earnings-controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", listEarnings);
router.post("/", createEarning);

export default router;
