async function adminRoutes(app, options) {
  const { db, auth } = options;

  const listUsers = db.prepare("SELECT id, username, role FROM users ORDER BY username");
  const updateUserRoleById = db.prepare("UPDATE users SET role = ? WHERE id = ?");
  const deleteUserById = db.prepare("DELETE FROM users WHERE id = ?");

  app.get("/admin/users", { preHandler: auth.requireAdmin }, async () => {
    return {
      users: listUsers.all(),
    };
  });

  app.put("/admin/users/:id", { preHandler: auth.requireAdmin }, async (request, reply) => {
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

  app.delete("/admin/users/:id", { preHandler: auth.requireAdmin }, async (request, reply) => {
    const userId = Number(request.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    auth.invalidateUserSessions(userId);
    const result = deleteUserById.run(userId);
    if (result.changes === 0) {
      return reply.code(404).send({ error: "User not found" });
    }

    return reply.code(204).send();
  });
}

module.exports = adminRoutes;
