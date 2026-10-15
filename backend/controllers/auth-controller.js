import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "../config/database.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { hashSessionToken, readSessionToken, SESSION_COOKIE } from "../middleware/require-auth.js";

const scrypt = promisify(scryptCallback);
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function setSessionCookie(response, token) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionLifetimeMs
  });
}

function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, encodedHash) {
  const [algorithm, saltHex, hashHex] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/i.test(saltHex || "")
    || !/^[a-f0-9]{128}$/i.test(hashHex || "")) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

function isValidPhone(phone) {
  return phone === null || /^\+[1-9]\d{7,14}$/.test(phone);
}

async function createSession(client, userId) {
  const token = randomBytes(32).toString("base64url");
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1::uuid, $2, now() + interval '30 days')`,
    [userId, hashSessionToken(token)]
  );
  return token;
}

export const register = asyncHandler(async (request, response) => {
  const { fullName, email, phone = null, password } = request.body || {};
  if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 120
    || typeof email !== "string" || email.trim().length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    || !isValidPhone(phone)
    || typeof password !== "string" || password.length < 8 || password.length > 128) {
    response.status(400).json({
      error: "Provide a valid name, email, optional international phone number, and password of at least 8 characters."
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO users (email, phone, password_hash, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, phone, full_name`,
      [email.trim().toLowerCase(), phone, passwordHash, fullName.trim()]
    );
    const user = result.rows[0];
    await client.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1::uuid, 'driver')",
      [user.id]
    );
    await client.query(
      "INSERT INTO drivers (user_id, status) VALUES ($1::uuid, 'pending')",
      [user.id]
    );
    const token = await createSession(client, user.id);
    await client.query("COMMIT");
    setSessionCookie(response, token);
    response.status(201).json({
      user: { id: user.id, email: user.email, phone: user.phone, fullName: user.full_name }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      response.status(409).json({ error: "An account already exists with that email or phone number." });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
});

export const login = asyncHandler(async (request, response) => {
  const { email, password } = request.body || {};
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    response.status(400).json({ error: "Email and password are required." });
    return;
  }

  const result = await pool.query(
    `SELECT u.id, u.email, u.phone, u.full_name, u.password_hash
     FROM users u
     JOIN user_roles r ON r.user_id = u.id AND r.role = 'driver'
     JOIN drivers d ON d.user_id = u.id
     WHERE u.email = $1 AND u.is_active`,
    [email.trim().toLowerCase()]
  );
  if (result.rowCount !== 1 || !(await verifyPassword(password, result.rows[0].password_hash))) {
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const user = result.rows[0];
  const client = await pool.connect();
  let token;
  try {
    await client.query("BEGIN");
    token = await createSession(client, user.id);
    await client.query(
      "UPDATE users SET last_login_at = now(), failed_login_count = 0, updated_at = now() WHERE id = $1::uuid",
      [user.id]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  setSessionCookie(response, token);
  response.json({
    user: { id: user.id, email: user.email, phone: user.phone, fullName: user.full_name }
  });
});

export const logout = asyncHandler(async (request, response) => {
  const token = readSessionToken(request);
  if (token) {
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
      [hashSessionToken(token)]
    );
  }
  clearSessionCookie(response);
  response.status(204).end();
});

export function currentUser(request, response) {
  response.json({ user: request.authUser });
}
