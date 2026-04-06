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

  function normalizeCitations(citations) {
    if (!citations || typeof citations !== "object" || Array.isArray(citations)) {
      return null;
    }

    const normalized = {};
    for (const [key, value] of Object.entries(citations)) {
      if (typeof value !== "string") {
        return null;
      }
      normalized[String(key)] = value.trim();
    }
    return normalized;
  }

  function validatePageData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { error: "Body data must be an object" };
    }

    if (typeof data.title !== "string" || !data.title.trim()) {
      return { error: "Body data must include non-empty string title" };
    }

    if (typeof data.body !== "string") {
      return { error: "Body data must include string body" };
    }

    const citations = normalizeCitations(data.citations ?? {});
    if (!citations) {
      return { error: "Body data citations must be an object of string values" };
    }

    return {
      value: {
        title: data.title.trim(),
        body: data.body,
        citations,
      },
    };
  }

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

    if (!id || typeof id !== "string" || !id.trim()) {
      return reply.code(400).send({ error: "Body must include string id" });
    }

    if (data === undefined) {
      return reply.code(400).send({ error: "Body must include data" });
    }

    const validated = validatePageData(data);
    if (validated.error) {
      return reply.code(400).send({ error: validated.error });
    }

    const normalizedData = validated.value;
    const normalizedId = id.trim();
    if (normalizedData.title !== normalizedId) {
      return reply.code(400).send({ error: "Body id must match data.title" });
    }

    try {
      insertPage.run(normalizedId, JSON.stringify(normalizedData));
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        return reply.code(409).send({ error: "Page with this id already exists" });
      }
      throw error;
    }

    return reply.code(201).send({ id: normalizedId, data: normalizedData });
  });

  app.put("/pages/:id", { preHandler: auth.requireCurator }, async (request, reply) => {
    const { data } = request.body || {};
    const { id } = request.params;

    if (data === undefined) {
      return reply.code(400).send({ error: "Body must include data" });
    }

    const validated = validatePageData(data);
    if (validated.error) {
      return reply.code(400).send({ error: validated.error });
    }

    const normalizedData = validated.value;
    const newId = normalizedData.title;

    if (newId === id) {
      const result = updatePage.run(JSON.stringify(normalizedData), id);
      if (result.changes === 0) {
        return reply.code(404).send({ error: "Page not found" });
      }

      return { id: newId, data: normalizedData };
    }

    if (getPageIdOnly.get(newId)) {
      return reply.code(409).send({ error: "Page with this title already exists" });
    }

    if (!getPageIdOnly.get(id)) {
      return reply.code(404).send({ error: "Page not found" });
    }

    try {
      renamePageTransaction(id, newId, normalizedData);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        return reply.code(409).send({ error: "Page with this title already exists" });
      }
      throw error;
    }

    return { id: newId, data: normalizedData };
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
