const path = require("node:path");
const crypto = require("node:crypto");
const Fastify = require("fastify");
const Database = require("better-sqlite3");

const app = Fastify({ logger: true });
const dbPath = path.join(__dirname, "data.db");
const db = new Database(dbPath);

app.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  if (request.method === "OPTIONS") {
    return reply.code(204).send();
  }
});

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
const updateUserToken = db.prepare(
  "UPDATE users SET auth_token = ? WHERE id = ?"
);
const getUserByToken = db.prepare(
  "SELECT id, username, role FROM users WHERE auth_token = ?"
);
const setUserRoleByUsername = db.prepare(
  "UPDATE users SET role = ? WHERE username = ?"
);

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
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const user = getUserByToken.get(token);
  if (!user) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  if (user.role !== "curator" && user.role !== "admin") {
    return reply.code(403).send({ error: "Curator or admin role required" });
  }

  request.user = user;
}

async function requireAdmin(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const user = getUserByToken.get(token);
  if (!user) {
    return reply.code(401).send({ error: "Authentication required" });
  }

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

  const token = crypto.randomBytes(32).toString("hex");
  updateUserToken.run(token, user.id);

  return {
    token,
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
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  const user = getUserByToken.get(token);
  if (!user) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
});

app.addHook("onClose", async () => {
  db.close();
});

const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
