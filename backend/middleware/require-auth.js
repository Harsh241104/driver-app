import { createHash } from "node:crypto";
import { pool } from "../config/database.js";
import { asyncHandler } from "./async-handler.js";

export const SESSION_COOKIE = "driver_session";

export function readSessionToken(request) {
  const cookie = request.headers.cookie?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  return token && /^[A-Za-z0-9_-]{40,}$/.test(token) ? token : null;
}

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export const requireAuth = asyncHandler(async (request, response, next) => {
  const token = readSessionToken(request);
  if (!token) {
    response.status(401).json({ error: "Sign in to access this resource." });
    return;
  }

  const result = await pool.query(
    `SELECT u.id, u.email, u.phone, u.full_name
     FROM refresh_tokens t
     JOIN users u ON u.id = t.user_id
     JOIN user_roles r ON r.user_id = u.id AND r.role = 'driver'
     JOIN drivers d ON d.user_id = u.id
     WHERE t.token_hash = $1
       AND t.revoked_at IS NULL
       AND t.expires_at > now()
       AND u.is_active`,
    [hashSessionToken(token)]
  );

  if (result.rowCount !== 1) {
    response.status(401).json({ error: "Your session has expired. Sign in again." });
    return;
  }

  request.authUser = {
    id: result.rows[0].id,
    email: result.rows[0].email,
    phone: result.rows[0].phone,
    fullName: result.rows[0].full_name
  };
  next();
});
