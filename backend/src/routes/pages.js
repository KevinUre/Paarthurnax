async function pagesRoutes(app, options) {
  const { db, auth } = options;

  const insertPage = db.prepare("INSERT INTO pages (id, data) VALUES (?, json(?))");
  const getPage = db.prepare("SELECT id, data FROM pages WHERE id = ?");
  const getPageIdOnly = db.prepare("SELECT id FROM pages WHERE id = ?");
  const listPages = db.prepare("SELECT id, data FROM pages ORDER BY id");
  const listAllPages = db.prepare("SELECT id, data FROM pages");
  const updatePage = db.prepare("UPDATE pages SET data = json(?) WHERE id = ?");
  const renameAndUpdatePage = db.prepare("UPDATE pages SET id = ?, data = json(?) WHERE id = ?");
  const deletePage = db.prepare("DELETE FROM pages WHERE id = ?");

  function rewriteWikiLinksInString(text, oldId, newId) {
    if (typeof text !== "string") {
      return text;
    }

    return text.replace(/\[\[([^|\]]+)(\|[^\]]*)?\]\]/g, (fullMatch, target, alias = "") => {
      if (target.trim() !== oldId) {
        return fullMatch;
      }
      return `[[${newId}${alias}]]`;
    });
  }

  function rewriteWikiLinksInValue(value, oldId, newId) {
    if (typeof value === "string") {
      return rewriteWikiLinksInString(value, oldId, newId);
    }
    if (Array.isArray(value)) {
      return value.map((item) => rewriteWikiLinksInValue(item, oldId, newId));
    }
    if (value && typeof value === "object") {
      const next = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        next[key] = rewriteWikiLinksInValue(nestedValue, oldId, newId);
      }
      return next;
    }
    return value;
  }

  const renamePageTransaction = db.transaction((oldId, newId, incomingData) => {
    const allRows = listAllPages.all();

    for (const row of allRows) {
      if (row.id === oldId) {
        continue;
      }

      const originalData = JSON.parse(row.data);
      const rewrittenData = rewriteWikiLinksInValue(originalData, oldId, newId);
      if (JSON.stringify(originalData) !== JSON.stringify(rewrittenData)) {
        updatePage.run(JSON.stringify(rewrittenData), row.id);
      }
    }

    const rewrittenIncomingData = rewriteWikiLinksInValue(incomingData, oldId, newId);
    rewrittenIncomingData.title = newId;
    renameAndUpdatePage.run(newId, JSON.stringify(rewrittenIncomingData), oldId);
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

    if (!data || typeof data !== "object") {
      return reply.code(400).send({ error: "Body data must be an object" });
    }

    if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
      return reply.code(400).send({ error: "Body data must include non-empty string title" });
    }

    const newId = data.title.trim();

    if (newId === id) {
      const result = updatePage.run(JSON.stringify(data), id);
      if (result.changes === 0) {
        return reply.code(404).send({ error: "Page not found" });
      }

      return { id: newId, data };
    }

    if (getPageIdOnly.get(newId)) {
      return reply.code(409).send({ error: "Page with this title already exists" });
    }

    if (!getPageIdOnly.get(id)) {
      return reply.code(404).send({ error: "Page not found" });
    }

    try {
      renamePageTransaction(id, newId, data);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        return reply.code(409).send({ error: "Page with this title already exists" });
      }
      throw error;
    }

    return { id: newId, data: { ...data, title: newId } };
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
