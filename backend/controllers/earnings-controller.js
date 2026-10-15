import { pool } from "../config/database.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const listEarnings = asyncHandler(async (request, response) => {
  const result = await pool.query(
    `SELECT
       e.id, e.route_stop_id, e.amount, e.currency, e.status, e.earned_at, e.paid_at,
       o.merchant_order_ref, o.recipient_name, s.locality
     FROM earnings e
     JOIN route_stops s ON s.id = e.route_stop_id
     JOIN orders o ON o.id = s.order_id
     WHERE e.driver_id = $1::uuid
     ORDER BY e.earned_at DESC, e.id DESC`,
    [request.authUser.id]
  );
  const totalAmount = result.rows.reduce((total, earning) => total + Number(earning.amount), 0);
  response.json({
    summary: { totalAmount, currency: "INR", deliveryCount: result.rowCount },
    earnings: result.rows
  });
});

export const createEarning = asyncHandler(async (request, response) => {
  const { routeStopId } = request.body || {};
  if (typeof routeStopId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeStopId)) {
    response.status(400).json({ error: "routeStopId must be a valid UUID." });
    return;
  }

  const result = await pool.query(
    `INSERT INTO earnings (driver_id, route_stop_id, amount, currency)
     SELECT $1::uuid, s.id, 45.00, 'INR'
     FROM route_stops s
     JOIN routes r ON r.id = s.route_id
     WHERE s.id = $2::uuid
       AND r.driver_id = $1::uuid
       AND s.status = 'delivered'
     ON CONFLICT (route_stop_id) DO NOTHING
     RETURNING id, route_stop_id, amount, currency, status, earned_at, paid_at`,
    [request.authUser.id, routeStopId]
  );
  if (result.rowCount === 1) {
    response.status(201).json({ earning: result.rows[0] });
    return;
  }

  const existing = await pool.query(
    `SELECT id, route_stop_id, amount, currency, status, earned_at, paid_at
     FROM earnings WHERE route_stop_id = $1::uuid AND driver_id = $2::uuid`,
    [routeStopId, request.authUser.id]
  );
  if (existing.rowCount === 1) {
    response.json({ earning: existing.rows[0], duplicate: true });
    return;
  }
  response.status(409).json({ error: "Earnings can only be recorded for your completed deliveries." });
});
