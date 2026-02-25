async function pagesRoutes(app, options) {
  const { db, auth } = options;

  const insertPage = db.prepare("INSERT INTO pages (id, data) VALUES (?, json(?))");
  const getPage = db.prepare("SELECT id, data FROM pages WHERE id = ?");
  const listPages = db.prepare("SELECT id, data FROM pages ORDER BY id");
  const updatePage = db.prepare("UPDATE pages SET data = json(?) WHERE id = ?");
  const deletePage = db.prepare("DELETE FROM pages WHERE id = ?");

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

  app.post("/pages", { preHandler: auth.requireCurator }, async (request, reply) => {
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

  app.put("/pages/:id", { preHandler: auth.requireCurator }, async (request, reply) => {
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

  app.delete("/pages/:id", { preHandler: auth.requireCurator }, async (request, reply) => {
    const result = deletePage.run(request.params.id);
    if (result.changes === 0) {
      return reply.code(404).send({ error: "Page not found" });
    }

    return reply.code(204).send();
  });
}

module.exports = pagesRoutes;
