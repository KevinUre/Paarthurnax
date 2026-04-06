const Database = require("better-sqlite3");
const path = require("node:path");
const { config } = require("../src/config.js");

function normalizeParagraphs(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function normalizeCitations(citations) {
  if (!citations || typeof citations !== "object" || Array.isArray(citations)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(citations)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([key, value]) => [String(key), value.trim()])
  );
}

function addSection(sections, heading, content) {
  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (!trimmedContent) {
    return;
  }

  sections.push(`## ${heading}\n\n${trimmedContent}`);
}

function buildBodyFromLegacyData(data) {
  const sections = [];
  const description = typeof data.description === "string" ? data.description.trim() : "";

  addSection(sections, "Description", description);
  addSection(sections, "Talking Points", normalizeParagraphs(data.talkingPoints).join("\n\n"));
  addSection(sections, "Questions", normalizeParagraphs(data.questions).join("\n\n"));
  addSection(sections, "Related", normalizeParagraphs(data.related).join("\n\n"));

  return sections.join("\n\n");
}

function migratePageRecord(id, rawData) {
  const title = typeof rawData.title === "string" && rawData.title.trim() ? rawData.title.trim() : id;
  const citations = normalizeCitations(rawData.citations);

  if (typeof rawData.body === "string") {
    const normalizedData = {
      title,
      body: rawData.body,
      citations,
    };

    return {
      id,
      data: normalizedData,
      changed: JSON.stringify(rawData) !== JSON.stringify(normalizedData),
    };
  }

  return {
    id,
    data: {
      title,
      body: buildBodyFromLegacyData(rawData),
      citations,
    },
    changed: true,
  };
}

function main() {
  const dbPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : config.dbPath;

  const db = new Database(dbPath);
  const listPages = db.prepare("SELECT id, data FROM pages");
  const updatePage = db.prepare("UPDATE pages SET data = json(?) WHERE id = ?");

  const pages = listPages.all();
  const migratePages = db.transaction((rows) => {
    let changedCount = 0;

    for (const row of rows) {
      const rawData = JSON.parse(row.data);
      const migrated = migratePageRecord(row.id, rawData);
      if (!migrated.changed) {
        continue;
      }

      updatePage.run(JSON.stringify(migrated.data), row.id);
      changedCount += 1;
    }

    return changedCount;
  });

  const changedCount = migratePages(pages);
  db.close();

  console.log(`Migrated ${changedCount} of ${pages.length} pages in ${dbPath}`);
}

main();
