import { pool } from "../config/database.js";
import { asyncHandler } from "../middleware/async-handler.js";

const failureReasons = new Set(["recipient_unavailable", "wrong_address", "refused", "other"]);

export const listDeliveries = asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT
       s.id AS route_stop_id, s.sequence, s.status AS stop_status,
       s.failure_reason, s.planned_arrival_at, s.arrived_at, s.completed_at,
       s.instructions, s.locality, s.landmark,
       o.id AS order_id, o.merchant_order_ref, o.status AS order_status,
       o.recipient_name, o.recipient_phone, o.delivery_address,
       o.weight_kg, o.volume_m3, o.window_earliest, o.window_latest
     FROM routes r
     JOIN route_stops s ON s.route_id = r.id
     JOIN orders o ON o.id = s.order_id
     WHERE r.driver_id = $1::uuid
       AND r.status IN ('planned', 'in_progress', 'completed')
     ORDER BY r.created_at DESC, s.sequence`,
    [request.authUser.id]
  );
  response.json({ deliveries: result.rows });
});

export const updateDeliveryStatus = asyncHandler(async (request, response) => {
  const { status, failureReason = null } = request.body || {};
  if (!["delivered", "failed"].includes(status)
    || (status === "failed" && !failureReasons.has(failureReason))
    || (status === "delivered" && failureReason !== null)) {
    response.status(400).json({
      error: "Status must be delivered or failed; failed deliveries require a valid failureReason."
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const stopResult = await client.query(
      `      SELECT s.id, s.status, r.id AS route_id, o.id AS order_id, o.status AS order_status
       FROM route_stops s
       JOIN routes r ON r.id = s.route_id
       JOIN orders o ON o.id = s.order_id
      WHERE s.id = $1::uuid
        AND r.driver_id = $2::uuid
        AND r.status IN ('planned', 'in_progress')
      FOR UPDATE OF s, o`,
      [request.params.stopId, request.authUser.id]
    );
    if (stopResult.rowCount !== 1) {
      await client.query("ROLLBACK");
      response.status(404).json({ error: "Delivery stop not found." });
      return;
    }
    const stop = stopResult.rows[0];
    if (stop.status !== "pending") {
      await client.query("ROLLBACK");
      response.status(409).json({ error: "This delivery stop has already been completed." });
      return;
    }

    const orderStatus = status === "delivered" ? "delivered" : "attempt_failed";
    await client.query(
      `UPDATE route_stops
       SET status = $2::stop_status,
           failure_reason = $3::failure_reason,
           completed_at = now(),
           updated_at = now()
       WHERE id = $1::uuid`,
      [stop.id, status, failureReason]
    );
    await client.query(
      "UPDATE orders SET status = $2::order_status, updated_at = now() WHERE id = $1::uuid",
      [stop.order_id, orderStatus]
    );
    if (stop.order_status !== orderStatus) {
      await client.query(
        `INSERT INTO order_events (order_id, from_status, to_status, route_stop_id, actor_user_id)
         VALUES ($1::uuid, $2::order_status, $3::order_status, $4::uuid, $5::uuid)`,
        [stop.order_id, stop.order_status, orderStatus, stop.id, request.authUser.id]
      );
    }
    if (status === "delivered") {
      await client.query(
        `INSERT INTO earnings (driver_id, route_stop_id, amount, currency)
         VALUES ($1::uuid, $2::uuid, 45.00, 'INR')
         ON CONFLICT (route_stop_id) DO NOTHING`,
        [request.authUser.id, stop.id]
      );
    }
    const remainingStops = await client.query(
      "SELECT 1 FROM route_stops WHERE route_id = $1::uuid AND status = 'pending' LIMIT 1",
      [stop.route_id]
    );
    if (remainingStops.rowCount === 0) {
      await client.query(
        `UPDATE routes
         SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
         WHERE id = $1::uuid`,
        [stop.route_id]
      );
    }

    await client.query("COMMIT");
    response.status(200).json({ delivery: { routeStopId: stop.id, orderId: stop.order_id, status } });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "22P02") {
      response.status(400).json({ error: "stopId must be a valid UUID." });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
});
