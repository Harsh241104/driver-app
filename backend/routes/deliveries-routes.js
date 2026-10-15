import { Router } from "express";
import { listDeliveries, updateDeliveryStatus } from "../controllers/deliveries-controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.use(requireAuth);
router.get("/", listDeliveries);
router.post("/:stopId/status", updateDeliveryStatus);

export default router;
