async function authRoutes(app, options) {
  const { db, auth } = options;

  const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
  const getUserByUsername = db.prepare(
    "SELECT id, username, password_hash, role FROM users WHERE username = ?"
  );

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

    const passwordHash = auth.hashPassword(password);

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
    if (!user || !auth.verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    const session = auth.createSessionTokens(user.id);

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

  app.get("/auth/me", { preHandler: auth.requireAuthenticated }, async (request) => {
    return {
      user: request.user,
    };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (!refreshToken || typeof refreshToken !== "string") {
      return reply.code(400).send({ error: "Body must include string refreshToken" });
    }

    const normalizedRefreshToken = refreshToken.trim();
    const session = auth.getSessionByRefreshToken(normalizedRefreshToken);
    if (!session) {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }

    if (session.refresh_expires_at <= Date.now()) {
      auth.invalidateRefreshToken(normalizedRefreshToken);
      return reply.code(401).send({ error: "Refresh token expired" });
    }

    const rotated = auth.rotateSession(session.session_id);

    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      accessExpiresAt: rotated.accessExpiresAt,
      refreshExpiresAt: rotated.refreshExpiresAt,
      user: {
        id: session.user_id,
        username: session.username,
        role: session.role,
      },
    };
  });

  app.post("/auth/logout", { preHandler: auth.requireAuthenticated }, async (request, reply) => {
    auth.invalidateAccessToken(request.accessToken);
    return reply.code(204).send();
  });
}

module.exports = authRoutes;
