import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiRequest } from "../api.js";
import { canManagePages } from "../utils/pageData.js";

function transformBodyMarkdown(text) {
  if (typeof text !== "string" || !text.trim()) {
    return "";
  }

  return text
    .replace(/\[\[([^|\]]+)(\|[^\]]*)?\]\]/g, (_match, targetRaw, alias = "") => {
      const target = String(targetRaw || "").trim();
      const label = String(alias || "").slice(1).trim() || target;
      if (!target) {
        return _match;
      }
      return `[${label}](/__page__/${encodeURIComponent(target)})`;
    })
    .replace(/\[(\d+)\](?!\()/g, (_match, citationId) => `[\[${citationId}\]](#citation-${citationId})`);
}

export default function PageDetail({
  user,
  pageHistory = [],
  pageIndex = [],
  onOpenRelatedPage,
  onPopHistoryToPage,
}) {
  const { id } = useParams();
  const [page, setPage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");
    apiRequest(`/pages/${encodeURIComponent(id)}`)
      .then((result) => setPage(result))
      .catch((err) => {
        setPage(null);
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const citationEntries = useMemo(() => {
    const citations = page?.data?.citations;
    if (!citations || typeof citations !== "object") {
      return [];
    }
    return Object.entries(citations).sort(([a], [b]) => Number(a) - Number(b));
  }, [page]);

  const titleById = useMemo(() => {
    return new Map(pageIndex.map((item) => [item.id, item.title]));
  }, [pageIndex]);

  const breadcrumbItems = useMemo(() => {
    return pageHistory.map((pageId) => ({
      id: pageId,
      title: titleById.get(pageId) || pageId,
    }));
  }, [pageHistory, titleById]);

  const data = page?.data || {};
  const body = typeof data.body === "string" ? data.body : "";
  const markdownBody = useMemo(() => transformBodyMarkdown(body), [body]);

  if (isLoading) {
    return (
      <section className="hero">
        <p>Loading page...</p>
      </section>
    );
  }

  if (error || !page) {
    return (
      <section className="hero">
        <h1>Page not found</h1>
        <p className="error">{error || "No page returned."}</p>
      </section>
    );
  }

  return (
    <article className="detail-page">
      {breadcrumbItems.length ? (
        <p className="eyebrow breadcrumb-truncate">
          <span className="breadcrumb-line">
            {breadcrumbItems.map((item, index) => (
              <span className="breadcrumb-part" key={`${item.id}-${index}`}>
                {index > 0 ? <span className="breadcrumb-separator">{">"}</span> : null}
                <Link
                  to={`/pages/${encodeURIComponent(item.id)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onPopHistoryToPage?.(item.id);
                  }}
                >
                  {item.title}
                </Link>
              </span>
            ))}
          </span>
        </p>
      ) : null}

      <header className="detail-header detail-header-row">
        <h1>{data.title || page.id}</h1>
        {canManagePages(user) ? (
          <Link className="button button-secondary" to={`/pages/${encodeURIComponent(page.id)}/edit`}>
            Edit
          </Link>
        ) : null}
      </header>

      {markdownBody ? (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a({ href, children }) {
                if (typeof href === "string" && href.startsWith("/__page__/")) {
                  const targetId = decodeURIComponent(href.slice("/__page__/".length));
                  return (
                    <Link
                      to={`/pages/${encodeURIComponent(targetId)}`}
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenRelatedPage?.(page.id, targetId);
                      }}
                    >
                      {children}
                    </Link>
                  );
                }

                if (typeof href === "string" && href.startsWith("#citation-")) {
                  return (
                    <a href={href} className="citation-link">
                      {children}
                    </a>
                  );
                }

                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                );
              },
            }}
          >
            {markdownBody}
          </ReactMarkdown>
        </div>
      ) : null}

      {citationEntries.length ? (
        <section className="detail-section">
          <h2>Citations</h2>
          <ol className="citation-list">
            {citationEntries.map(([key, value]) => (
              <li id={`citation-${key}`} key={key}>
                <a href={value} target="_blank" rel="noreferrer">
                  {value}
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
