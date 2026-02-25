const path = require("node:path");
const crypto = require("node:crypto");
require("dotenv").config();
const Fastify = require("fastify");
const Database = require("better-sqlite3");

function getEnvBoolean(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return defaultValue;
  }

  const value = rawValue.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

const corsEnabled = getEnvBoolean("CORS_ENABLED", true);
const corsOriginList = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const corsAllowLocalhost = getEnvBoolean(
  "CORS_ALLOW_LOCALHOST",
  process.env.NODE_ENV !== "production"
);
const cspEnabled = getEnvBoolean("CSP_ENABLED", process.env.NODE_ENV === "production");
const cspConnectSrc = (process.env.CSP_CONNECT_SRC || "'self' http://localhost:5173 ws://localhost:5173")
  .split(/\s+/)
  .map((value) => value.trim())
  .filter(Boolean);
const cspPolicyOverride = process.env.CSP_POLICY;
const port = Number(process.env.PORT) || 3000;
const accessTokenTtlMinutes = Number(process.env.ACCESS_TOKEN_TTL_MINUTES) || 30;
const refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 14;

const app = Fastify({ logger: true });
const dbPath = path.join(__dirname, "data.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

function buildCspPolicy() {
  if (cspPolicyOverride) {
    return cspPolicyOverride;
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src ${cspConnectSrc.join(" ")}`,
  ].join("; ");
}

const cspPolicy = buildCspPolicy();

function resolveCorsOrigin(origin) {
  if (!origin) {
    return null;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return null;
  }

  if (corsOriginList.some((value) => normalizeOrigin(value) === "*")) {
    return "*";
  }

  if (corsAllowLocalhost && isLocalhostOrigin(normalizedOrigin)) {
    return normalizedOrigin;
  }

  for (const allowed of corsOriginList) {
    if (normalizeOrigin(allowed) === normalizedOrigin) {
      return normalizedOrigin;
    }
  }

  return null;
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw === "*") {
    return "*";
  }

  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function isLocalhostOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

if (corsEnabled) {
  app.addHook("onRequest", async (request, reply) => {
    const requestOrigin = request.headers.origin;
    const allowedOrigin = resolveCorsOrigin(requestOrigin);
    if (requestOrigin && !allowedOrigin) {
      return reply.code(403).send({ error: "Origin not allowed by CORS policy" });
    }

    if (allowedOrigin) {
      reply.header("Access-Control-Allow-Origin", allowedOrigin);
      reply.header("Vary", "Origin");
      reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    }

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
} else {
  // Permissive CORS mode for local debugging: allow all origins.
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}

if (cspEnabled) {
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Content-Security-Policy", cspPolicy);
  });
}

db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    data JSON NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'guest',
    auth_token TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    access_token TEXT NOT NULL UNIQUE,
    refresh_token TEXT NOT NULL UNIQUE,
    access_expires_at INTEGER NOT NULL,
    refresh_expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "role")) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'guest'");
}
if (!userColumns.some((column) => column.name === "auth_token")) {
  db.exec("ALTER TABLE users ADD COLUMN auth_token TEXT");
}

const insertPage = db.prepare(
  "INSERT INTO pages (id, data) VALUES (?, json(?))"
);
const getPage = db.prepare("SELECT id, data FROM pages WHERE id = ?");
const listPages = db.prepare("SELECT id, data FROM pages ORDER BY id");
const updatePage = db.prepare(
  "UPDATE pages SET data = json(?) WHERE id = ?"
);
const deletePage = db.prepare("DELETE FROM pages WHERE id = ?");
const insertUser = db.prepare(
  "INSERT INTO users (username, password_hash) VALUES (?, ?)"
);
const getUserByUsername = db.prepare(
  "SELECT id, username, password_hash, role FROM users WHERE username = ?"
);
const setUserRoleByUsername = db.prepare(
  "UPDATE users SET role = ? WHERE username = ?"
);
const listUsers = db.prepare("SELECT id, username, role FROM users ORDER BY username");
const updateUserRoleById = db.prepare("UPDATE users SET role = ? WHERE id = ?");
const deleteUserById = db.prepare("DELETE FROM users WHERE id = ?");
const createSession = db.prepare(`
  INSERT INTO sessions (
    user_id,
    access_token,
    refresh_token,
    access_expires_at,
    refresh_expires_at,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?)
`);
const getSessionByAccessToken = db.prepare(`
  SELECT
    sessions.id AS session_id,
    sessions.user_id,
    sessions.access_expires_at,
    sessions.refresh_expires_at,
    users.username,
    users.role
  FROM sessions
  JOIN users ON users.id = sessions.user_id
  WHERE sessions.access_token = ?
`);
const getSessionByRefreshToken = db.prepare(`
  SELECT
    sessions.id AS session_id,
    sessions.user_id,
    sessions.access_expires_at,
    sessions.refresh_expires_at,
    users.username,
    users.role
  FROM sessions
  JOIN users ON users.id = sessions.user_id
  WHERE sessions.refresh_token = ?
`);
const rotateSessionTokens = db.prepare(`
  UPDATE sessions
  SET
    access_token = ?,
    refresh_token = ?,
    access_expires_at = ?,
    refresh_expires_at = ?
  WHERE id = ?
`);
const deleteSessionByAccessToken = db.prepare("DELETE FROM sessions WHERE access_token = ?");
const deleteSessionByRefreshToken = db.prepare("DELETE FROM sessions WHERE refresh_token = ?");
const deleteSessionsByUserId = db.prepare("DELETE FROM sessions WHERE user_id = ?");

function nowMs() {
  return Date.now();
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createSessionTokens(userId) {
  const now = nowMs();
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const accessExpiresAt = now + accessTokenTtlMinutes * 60 * 1000;
  const refreshExpiresAt = now + refreshTokenTtlDays * 24 * 60 * 60 * 1000;

  createSession.run(
    userId,
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
    now
  );

  return {
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hashHex] = (storedHash || "").split(":");
  if (!salt || !hashHex) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, 64);
  const storedKey = Buffer.from(hashHex, "hex");
  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedKey, derivedKey);
}

async function requireCurator(request, reply) {
  const authHeader = request.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const session = getSessionByAccessToken.get(token);
  if (!session) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  if (session.access_expires_at <= nowMs()) {
    deleteSessionByAccessToken.run(token);
    return reply.code(401).send({ error: "Session expired" });
  }

  const user = {
    id: session.user_id,
    username: session.username,
    role: session.role,
  };

  if (user.role !== "curator" && user.role !== "admin") {
    return reply.code(403).send({ error: "Curator or admin role required" });
  }

  request.user = user;
}

async function requireAdmin(request, reply) {
  const authHeader = request.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const session = getSessionByAccessToken.get(token);
  if (!session) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  if (session.access_expires_at <= nowMs()) {
    deleteSessionByAccessToken.run(token);
    return reply.code(401).send({ error: "Session expired" });
  }

  const user = {
    id: session.user_id,
    username: session.username,
    role: session.role,
  };

  if (user.role !== "admin") {
    return reply.code(403).send({ error: "Admin role required" });
  }

  request.user = user;
}

app.get("/", async () => {
  return { message: "Hello, world!" };
});

app.get("/pages", async () => {
  const rows = listPages.all();
  return rows.map((row) => ({
    id: row.id,
    data: JSON.parse(row.data),
  }));
});

app.get("/pages/:id", async (request, reply) => {
  const row = getPage.get(request.params.id);
  if (!row) {
    return reply.code(404).send({ error: "Page not found" });
  }

  return {
    id: row.id,
    data: JSON.parse(row.data),
  };
});

app.post("/pages", { preHandler: requireCurator }, async (request, reply) => {
  const { id, data } = request.body || {};

  if (!id || typeof id !== "string") {
    return reply.code(400).send({ error: "Body must include string id" });
  }

  if (data === undefined) {
    return reply.code(400).send({ error: "Body must include data" });
  }

  try {
    insertPage.run(id, JSON.stringify(data));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
      return reply.code(409).send({ error: "Page with this id already exists" });
    }
    throw error;
  }

  return reply.code(201).send({ id, data });
});

app.put("/pages/:id", { preHandler: requireCurator }, async (request, reply) => {
  const { data } = request.body || {};
  const { id } = request.params;

  if (data === undefined) {
    return reply.code(400).send({ error: "Body must include data" });
  }

  const result = updatePage.run(JSON.stringify(data), id);
  if (result.changes === 0) {
    return reply.code(404).send({ error: "Page not found" });
  }

  return { id, data };
});

app.delete("/pages/:id", { preHandler: requireCurator }, async (request, reply) => {
  const result = deletePage.run(request.params.id);
  if (result.changes === 0) {
    return reply.code(404).send({ error: "Page not found" });
  }

  return reply.code(204).send();
});

app.post("/auth/signup", async (request, reply) => {
  const { username, password } = request.body || {};

  if (!username || typeof username !== "string") {
    return reply.code(400).send({ error: "Body must include string username" });
  }

  if (!password || typeof password !== "string") {
    return reply.code(400).send({ error: "Body must include string password" });
  }

  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    return reply.code(400).send({ error: "Username cannot be empty" });
  }

  const passwordHash = hashPassword(password);

  try {
    const result = insertUser.run(normalizedUsername, passwordHash);
    return reply.code(201).send({
      id: result.lastInsertRowid,
      username: normalizedUsername,
      role: "guest",
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return reply.code(409).send({ error: "Username already exists" });
    }
    throw error;
  }
});

app.post("/auth/signin", async (request, reply) => {
  const { username, password } = request.body || {};

  if (!username || typeof username !== "string") {
    return reply.code(400).send({ error: "Body must include string username" });
  }

  if (!password || typeof password !== "string") {
    return reply.code(400).send({ error: "Body must include string password" });
  }

  const user = getUserByUsername.get(username.trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return reply.code(401).send({ error: "Invalid username or password" });
  }

  const session = createSessionTokens(user.id);

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
});

app.post("/auth/promote", { preHandler: requireAdmin }, async (request, reply) => {
  const { username } = request.body || {};

  if (!username || typeof username !== "string") {
    return reply.code(400).send({ error: "Body must include string username" });
  }

  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    return reply.code(400).send({ error: "Username cannot be empty" });
  }

  const result = setUserRoleByUsername.run("curator", normalizedUsername);
  if (result.changes === 0) {
    return reply.code(404).send({ error: "User not found" });
  }

  return {
    username: normalizedUsername,
    role: "curator",
  };
});

app.get("/auth/me", async (request, reply) => {
  const authHeader = request.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const session = getSessionByAccessToken.get(token);
  if (!session) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  if (session.access_expires_at <= nowMs()) {
    deleteSessionByAccessToken.run(token);
    return reply.code(401).send({ error: "Session expired" });
  }

  return {
    user: {
      id: session.user_id,
      username: session.username,
      role: session.role,
    },
  };
});

app.post("/auth/refresh", async (request, reply) => {
  const { refreshToken } = request.body || {};
  if (!refreshToken || typeof refreshToken !== "string") {
    return reply.code(400).send({ error: "Body must include string refreshToken" });
  }

  const session = getSessionByRefreshToken.get(refreshToken.trim());
  if (!session) {
    return reply.code(401).send({ error: "Invalid refresh token" });
  }

  if (session.refresh_expires_at <= nowMs()) {
    deleteSessionByRefreshToken.run(refreshToken.trim());
    return reply.code(401).send({ error: "Refresh token expired" });
  }

  const now = nowMs();
  const nextAccessToken = generateToken();
  const nextRefreshToken = generateToken();
  const nextAccessExpiresAt = now + accessTokenTtlMinutes * 60 * 1000;
  const nextRefreshExpiresAt = now + refreshTokenTtlDays * 24 * 60 * 60 * 1000;

  rotateSessionTokens.run(
    nextAccessToken,
    nextRefreshToken,
    nextAccessExpiresAt,
    nextRefreshExpiresAt,
    session.session_id
  );

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    accessExpiresAt: nextAccessExpiresAt,
    refreshExpiresAt: nextRefreshExpiresAt,
    user: {
      id: session.user_id,
      username: session.username,
      role: session.role,
    },
  };
});

app.post("/auth/logout", async (request, reply) => {
  const authHeader = request.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  deleteSessionByAccessToken.run(token);
  return reply.code(204).send();
});

app.get("/admin/users", { preHandler: requireAdmin }, async () => {
  return {
    users: listUsers.all(),
  };
});

app.put("/admin/users/:id", { preHandler: requireAdmin }, async (request, reply) => {
  const { role } = request.body || {};
  const userId = Number(request.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return reply.code(400).send({ error: "Invalid user id" });
  }

  if (!role || typeof role !== "string" || !role.trim()) {
    return reply.code(400).send({ error: "Body must include non-empty string role" });
  }

  const normalizedRole = role.trim();
  const result = updateUserRoleById.run(normalizedRole, userId);
  if (result.changes === 0) {
    return reply.code(404).send({ error: "User not found" });
  }

  return {
    id: userId,
    role: normalizedRole,
  };
});

app.delete("/admin/users/:id", { preHandler: requireAdmin }, async (request, reply) => {
  const userId = Number(request.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return reply.code(400).send({ error: "Invalid user id" });
  }

  deleteSessionsByUserId.run(userId);
  const result = deleteUserById.run(userId);
  if (result.changes === 0) {
    return reply.code(404).send({ error: "User not found" });
  }

  return reply.code(204).send();
});

app.addHook("onClose", async () => {
  db.close();
});

const start = async () => {
  try {
    app.log.info({
      corsEnabled,
      corsAllowLocalhost,
      corsOriginList,
      cspEnabled,
      port,
    }, "Backend security configuration");
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
