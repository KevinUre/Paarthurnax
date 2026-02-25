const crypto = require("node:crypto");

function createAuthContext(db, config) {
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

  function createSessionTokens(userId) {
    const now = nowMs();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const accessExpiresAt = now + config.accessTokenTtlMinutes * 60 * 1000;
    const refreshExpiresAt = now + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

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

  function rotateSession(sessionId) {
    const now = nowMs();
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const accessExpiresAt = now + config.accessTokenTtlMinutes * 60 * 1000;
    const refreshExpiresAt = now + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

    rotateSessionTokens.run(
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
      sessionId
    );

    return {
      accessToken,
      refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
    };
  }

  function getAccessTokenFromRequest(request) {
    const authHeader = request.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return "";
    }
    return authHeader.slice("Bearer ".length).trim();
  }

  function getActiveSessionForToken(accessToken) {
    if (!accessToken) {
      return null;
    }

    const session = getSessionByAccessToken.get(accessToken);
    if (!session) {
      return null;
    }

    if (session.access_expires_at <= nowMs()) {
      deleteSessionByAccessToken.run(accessToken);
      return null;
    }

    return session;
  }

  async function requireAuthenticated(request, reply) {
    const accessToken = getAccessTokenFromRequest(request);
    if (!accessToken) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    const session = getActiveSessionForToken(accessToken);
    if (!session) {
      return reply.code(401).send({ error: "Authentication required" });
    }

    request.user = {
      id: session.user_id,
      username: session.username,
      role: session.role,
    };
    request.accessToken = accessToken;
    request.session = session;
  }

  async function requireCurator(request, reply) {
    const authResult = await requireAuthenticated(request, reply);
    if (authResult) {
      return authResult;
    }

    if (request.user.role !== "curator" && request.user.role !== "admin") {
      return reply.code(403).send({ error: "Curator or admin role required" });
    }
  }

  async function requireAdmin(request, reply) {
    const authResult = await requireAuthenticated(request, reply);
    if (authResult) {
      return authResult;
    }

    if (request.user.role !== "admin") {
      return reply.code(403).send({ error: "Admin role required" });
    }
  }

  return {
    hashPassword,
    verifyPassword,
    createSessionTokens,
    rotateSession,
    getSessionByRefreshToken: (token) => getSessionByRefreshToken.get(token),
    invalidateAccessToken: (token) => deleteSessionByAccessToken.run(token),
    invalidateRefreshToken: (token) => deleteSessionByRefreshToken.run(token),
    invalidateUserSessions: (userId) => deleteSessionsByUserId.run(userId),
    getAccessTokenFromRequest,
    getActiveSessionForToken,
    requireAuthenticated,
    requireCurator,
    requireAdmin,
  };
}

module.exports = {
  createAuthContext,
};
