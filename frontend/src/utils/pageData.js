export function canManagePages(user) {
  return user?.role === "curator" || user?.role === "admin";
}

export function linesToArray(multiline) {
  return multiline
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function arrayToLines(values) {
  if (!Array.isArray(values)) {
    return "";
  }
  return values.join("\n");
}

export function linesToCitations(multiline) {
  const citationUrls = linesToArray(multiline);
  return Object.fromEntries(citationUrls.map((url, index) => [String(index + 1), url]));
}

export function citationsToLines(citations) {
  if (!citations || typeof citations !== "object") {
    return "";
  }

  return Object.entries(citations)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => String(value))
    .join("\n");
}

export function rankPageMatches(pageIndex, rawQuery, limit = 8) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }

  return pageIndex
    .map((item) => {
      const title = item.title.toLowerCase();
      const exact = title === query ? 0 : 1;
      const startsWith = title.startsWith(query) ? 0 : 1;
      const includes = title.includes(query) ? 0 : 1;
      const position = title.indexOf(query);
      const rankPosition = position === -1 ? Number.MAX_SAFE_INTEGER : position;

      return { ...item, exact, startsWith, includes, rankPosition };
    })
    .filter((item) => item.includes === 0)
    .sort((a, b) =>
      a.exact - b.exact ||
      a.startsWith - b.startsWith ||
      a.rankPosition - b.rankPosition ||
      a.title.localeCompare(b.title)
    )
    .slice(0, limit);
}

export function getActiveWikiLinkQuery(text, cursorPosition) {
  const safeText = typeof text === "string" ? text : "";
  const cursor = Math.max(0, Math.min(cursorPosition ?? safeText.length, safeText.length));
  const beforeCursor = safeText.slice(0, cursor);
  const openIndex = beforeCursor.lastIndexOf("[[");
  if (openIndex < 0) {
    return null;
  }

  const closeIndex = beforeCursor.lastIndexOf("]]");
  if (closeIndex > openIndex) {
    return null;
  }

  const insideToken = beforeCursor.slice(openIndex + 2);
  if (insideToken.includes("\n")) {
    return null;
  }

  return insideToken.split("|")[0].trim();
}
