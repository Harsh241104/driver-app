import "dotenv/config";
import express from "express";
import pg from "pg";

const { Pool } = pg;
const port = Number(process.env.API_PORT || 3001);
const demoDriverId = "DRV-104";
const databaseDriverId = process.env.NEON_DRIVER_USER_ID;
const databaseRouteId = process.env.NEON_ROUTE_ID;
const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  })
  : null;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

function requireDatabase(_request, response, next) {
  if (!pool) {
    response.status(503).json({ error: "DATABASE_URL is not configured. Add your Neon connection string to the local .env file." });
    return;
  }
  next();
}

function handleDatabaseError(error, response) {
  console.error("Database request failed:", error.message);
  response.status(500).json({ error: "Database request failed. Check the API terminal and Neon connection settings." });
}

app.get("/api/health", requireDatabase, async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    handleDatabaseError(error, response);
  }
});

app.get("/api/routes/:routeId", requireDatabase, async (request, response) => {
  const routeId = request.params.routeId === "RT-RAIPUR-104" ? databaseRouteId : request.params.routeId;
  if (!routeId || !databaseDriverId) {
    response.status(503).json({ error: "NEON_DRIVER_USER_ID and NEON_ROUTE_ID are not configured. Run neon-demo-seed.sql and set both IDs in .env." });
    return;
  }
  const client = await pool.connect().catch((error) => {
    handleDatabaseError(error, response);
    return null;
  });
  if (!client) return;

  try {
    const routeResult = await client.query(
      `SELECT
         r.id AS route_id, r.status AS route_status,
         w.id AS warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
         w.address AS warehouse_address,
         ST_X(w.location::geometry) AS warehouse_longitude,
         ST_Y(w.location::geometry) AS warehouse_latitude,
         u.full_name AS driver_name, u.phone AS driver_phone,
         v.registration_number
       FROM routes r
       JOIN warehouses w ON w.id = r.warehouse_id
       JOIN drivers d ON d.user_id = r.driver_id
       JOIN users u ON u.id = d.user_id
       JOIN vehicles v ON v.id = r.vehicle_id
       WHERE r.id = $1::uuid AND r.driver_id = $2::uuid`,
      [routeId, databaseDriverId]
    );
    if (routeResult.rowCount === 0) {
      response.status(404).json({ error: "Route not found." });
      return;
    }

    const stopsResult = await client.query(
      `SELECT
         s.id AS stop_id, s.sequence, s.status AS stop_status,
         s.failure_reason, s.planned_arrival_at, s.instructions, s.demo_otp,
         s.locality, s.landmark,
         o.id AS order_id, o.merchant_order_ref, o.recipient_name,
         o.delivery_address, o.weight_kg, o.window_earliest, o.window_latest,
         ST_X(s.planned_location::geometry) AS longitude,
         ST_Y(s.planned_location::geometry) AS latitude
       FROM route_stops s
       JOIN orders o ON o.id = s.order_id
       WHERE s.route_id = $1::uuid
       ORDER BY s.sequence`,
      [routeId]
    );

    const rows = stopsResult.rows;
    const formatTime = (value) => value
      ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value)
      : "--:--";
    const mapStop = (stop) => {
      const status = stop.stop_status === "delivered" ? "Completed"
        : stop.stop_status === "failed" ? "Failed"
          : stop.stop_status === "skipped" ? "Skipped"
            : "Pending";
      return {
        id: stop.stop_id,
        orderId: stop.order_id,
        orderRef: stop.merchant_order_ref,
        name: stop.recipient_name,
        locality: stop.locality || stop.recipient_name,
        landmark: stop.landmark || "",
        address: stop.delivery_address,
        window: `${formatTime(stop.window_earliest)} – ${formatTime(stop.window_latest)}`,
        weight: Number(stop.weight_kg),
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        instructions: stop.instructions || "",
        otp: stop.demo_otp?.trim() || "",
        status
      };
    };
    const hub = routeResult.rows[0];

    response.json({
      id: "RT-RAIPUR-104",
      databaseId: hub.route_id,
      code: "RT-RAIPUR-104",
      name: "Raipur city loop",
      status: hub.route_status,
      driver: {
        name: hub.driver_name,
        phone: hub.driver_phone,
        vehicle: hub.registration_number
      },
      hub: {
        id: null,
        name: hub.warehouse_code,
        locality: "Pandri · Near Great Eastern Road",
        address: hub.warehouse_address,
        latitude: Number(hub.warehouse_latitude),
        longitude: Number(hub.warehouse_longitude),
        window: "08:00 – 08:30",
        weight: 9.9,
        status: "Pickup"
      },
      stops: rows.map(mapStop)
    });
  } catch (error) {
    handleDatabaseError(error, response);
  } finally {
    client.release();
  }
});

app.get("/driver/events", requireDatabase, async (request, response) => {
  const { driver_id: driverId, route_id: routeId } = request.query;
  if (driverId !== demoDriverId || (routeId !== "RT-RAIPUR-104" && routeId !== databaseRouteId)) {
    response.status(400).json({ error: "Only the seeded Raipur demo driver and route can be queried." });
    return;
  }
  if (!databaseDriverId || !databaseRouteId) {
    response.status(503).json({ error: "Set NEON_DRIVER_USER_ID and NEON_ROUTE_ID in .env after running the demo seed." });
    return;
  }
  if (typeof driverId !== "string" || typeof routeId !== "string") {
    response.status(400).json({ error: "driver_id and route_id are required." });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         e.event_id, e.event_type, e.occurred_at, e.route_id, e.route_stop_id,
         e.order_id, o.merchant_order_ref, e.latitude, e.longitude, e.metadata
       FROM driver_events e
       LEFT JOIN orders o ON o.id = e.order_id
       WHERE e.driver_user_id = $1::uuid AND e.route_id = $2::uuid
       ORDER BY occurred_at DESC
       LIMIT 100`,
      [databaseDriverId, databaseRouteId]
    );
    response.json(result.rows.map((event) => ({
      event_id: event.event_id,
      event_type: event.event_type,
      timestamp: event.occurred_at,
      driver_id: demoDriverId,
      route_id: "RT-RAIPUR-104",
      stop_id: event.route_stop_id,
      order_id: event.merchant_order_ref,
      latitude: event.latitude === null ? null : Number(event.latitude),
      longitude: event.longitude === null ? null : Number(event.longitude),
      metadata: event.metadata,
      sync_status: "SYNCED"
    })));
  } catch (error) {
    handleDatabaseError(error, response);
  }
});

app.post("/driver/events", requireDatabase, async (request, response) => {
  const event = request.body;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const supportedTypes = new Set([
    "driver.shift.started",
    "stop.arrived",
    "package.scanned",
    "delivery.completed",
    "delivery.failed",
    "driver.location.updated"
  ]);
  const coordinateIsValid = (value) => value === null || value === undefined
    || (typeof value === "number" && Number.isFinite(value));

  if (!event || typeof event !== "object" || Array.isArray(event)
    || typeof event.event_id !== "string" || !uuidPattern.test(event.event_id)
    || typeof event.event_type !== "string" || !supportedTypes.has(event.event_type)
    || event.driver_id !== demoDriverId
    || (event.route_id !== "RT-RAIPUR-104" && event.route_id !== databaseRouteId)
    || typeof event.timestamp !== "string" || Number.isNaN(Date.parse(event.timestamp))
    || (event.stop_id !== null && event.stop_id !== undefined && typeof event.stop_id !== "string")
    || (event.order_id !== null && event.order_id !== undefined && typeof event.order_id !== "string")
    || !coordinateIsValid(event.latitude) || !coordinateIsValid(event.longitude)
    || (event.latitude != null && (event.latitude < -90 || event.latitude > 90))
    || (event.longitude != null && (event.longitude < -180 || event.longitude > 180))
    || !event.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) {
    response.status(400).json({ error: "Invalid event payload." });
    return;
  }

  if (!databaseDriverId || !databaseRouteId) {
    response.status(503).json({ error: "Set NEON_DRIVER_USER_ID and NEON_ROUTE_ID in .env after running the demo seed." });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO driver_events (
           event_id, event_type, occurred_at, driver_user_id, route_id,
           route_stop_id, order_id, latitude, longitude, metadata
         )
         VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7::uuid, $8, $9, $10::jsonb)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [
        event.event_id,
        event.event_type,
        event.timestamp,
        databaseDriverId,
        databaseRouteId,
        event.stop_id || null,
        event.order_id || null,
        event.latitude ?? null,
        event.longitude ?? null,
        JSON.stringify(event.metadata)
        ]
      );

      if (result.rowCount) {
        if (event.event_type === "package.scanned") {
          await client.query(
            `UPDATE routes
             SET status = 'in_progress', started_at = COALESCE(started_at, $2), updated_at = now()
             WHERE id = $1::uuid AND status = 'planned'`,
            [databaseRouteId, event.timestamp]
          );
        }

        if (event.event_type === "stop.arrived" && event.stop_id) {
          await client.query(
            `UPDATE route_stops
             SET arrived_at = COALESCE(arrived_at, $2), updated_at = now()
             WHERE id = $1::uuid AND route_id = $3::uuid`,
            [event.stop_id, event.timestamp, databaseRouteId]
          );
        }

        if (event.event_type === "delivery.completed" || event.event_type === "delivery.failed") {
          if (!event.stop_id || !event.order_id) {
            throw new Error("A delivery event must include its route stop and order IDs.");
          }
          const stopResult = await client.query(
            `SELECT o.status AS order_status
             FROM route_stops s
             JOIN orders o ON o.id = s.order_id
             WHERE s.id = $1::uuid AND s.order_id = $2::uuid AND s.route_id = $3::uuid
             FOR UPDATE OF s, o`,
            [event.stop_id, event.order_id, databaseRouteId]
          );
          if (stopResult.rowCount !== 1) throw new Error("The delivery stop does not belong to this route.");

          const completed = event.event_type === "delivery.completed";
          const nextStopStatus = completed ? "delivered" : "failed";
          const nextOrderStatus = completed ? "delivered" : "attempt_failed";
          const failureReason = completed ? null : ({
            "Customer Unreachable / Phone Switched Off": "recipient_unavailable",
            "Incorrect / Incomplete Address": "wrong_address",
            "Customer Refused / Package Damaged": "refused"
          }[event.metadata.failure_reason] || "other");

          await client.query(
            `UPDATE route_stops
             SET status = $2::stop_status,
                 failure_reason = $3::failure_reason,
                 completed_at = $4,
                 updated_at = now()
             WHERE id = $1::uuid`,
            [event.stop_id, nextStopStatus, failureReason, event.timestamp]
          );
          await client.query(
            `UPDATE orders
             SET status = $2::order_status, updated_at = now()
             WHERE id = $1::uuid`,
            [event.order_id, nextOrderStatus]
          );
          await client.query(
            `INSERT INTO order_events (
               order_id, from_status, to_status, route_stop_id, actor_user_id
             )
             VALUES ($1::uuid, $2::order_status, $3::order_status, $4::uuid, $5::uuid)
             ON CONFLICT DO NOTHING`,
            [event.order_id, stopResult.rows[0].order_status, nextOrderStatus, event.stop_id, databaseDriverId]
          );

          const unfinished = await client.query(
            `SELECT 1
             FROM route_stops
             WHERE route_id = $1::uuid AND status = 'pending'
             LIMIT 1`,
            [databaseRouteId]
          );
          if (unfinished.rowCount === 0) {
            await client.query(
              `UPDATE routes
               SET status = 'completed', completed_at = COALESCE(completed_at, $2), updated_at = now()
               WHERE id = $1::uuid`,
              [databaseRouteId, event.timestamp]
            );
          }
        }
      }

      await client.query("COMMIT");
      response.status(result.rowCount ? 201 : 200).json({ saved: true, duplicate: result.rowCount === 0 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleDatabaseError(error, response);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Request body must be valid JSON." });
    return;
  }
  console.error("API request failed:", error.message);
  response.status(500).json({ error: "Unexpected API error." });
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Neon API listening at http://127.0.0.1:${port}`);
  if (!pool) console.error("DATABASE_URL is missing. Copy .env.example to .env and add your Neon connection string.");
  if (!databaseDriverId || !databaseRouteId) console.error("Demo Neon IDs are missing. Run neon-demo-seed.sql and configure the two IDs in .env.");
});

async function shutdown() {
  server.close();
  if (pool) await pool.end();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
