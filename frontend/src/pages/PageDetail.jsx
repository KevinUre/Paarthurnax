import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api.js";
import { canManagePages } from "../utils/pageData.js";

function renderRichText(text, onPageLinkClick) {
  if (typeof text !== "string" || !text) {
    return text;
  }

  const tokenPattern = /(\[\[[^[\]]+\]\]|\[\d+\])/g;
  const parts = text.split(tokenPattern);

  return parts.map((part, index) => {
    if (/^\[\[\S/.test(part) && part.endsWith("]]")) {
      const inner = part.slice(2, -2);
      const [targetRaw, labelRaw] = inner.split("|");
      const target = (targetRaw || "").trim();
      const label = (labelRaw || targetRaw || "").trim();

      if (!target) {
        return <span key={`txt-${index}`}>{part}</span>;
      }

      return (
        <Link
          key={`wikilink-${index}`}
          to={`/pages/${encodeURIComponent(target)}`}
          onClick={(event) => onPageLinkClick?.(event, target)}
        >
          {label || target}
        </Link>
      );
    }

    const citationMatch = part.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      const citationId = citationMatch[1];
      return (
        <a key={`cite-${index}`} href={`#citation-${citationId}`} className="citation-link">
          [{citationId}]
        </a>
      );
    }

    return <span key={`txt-${index}`}>{part}</span>;
  });
}

function Section({ title, children }) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
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

  const data = page.data || {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const talkingPoints = Array.isArray(data.talkingPoints) ? data.talkingPoints : [];
  const related = Array.isArray(data.related) ? data.related : [];
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const handlePageLinkClick = (event, targetId) => {
    event.preventDefault();
    onOpenRelatedPage?.(page.id, targetId);
  };

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

      {description ? (
        <Section title="Description">
          <p className="preserve-linebreaks">
            {renderRichText(description, handlePageLinkClick)}
          </p>
        </Section>
      ) : null}

      {talkingPoints.length ? (
        <Section title="Talking Points">
          <ul className="content-list">
            {talkingPoints.map((item, index) => (
              <li key={`point-${index}`}>{renderRichText(item, handlePageLinkClick)}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {questions.length ? (
        <Section title="Questions">
          <ul className="content-list">
            {questions.map((item, index) => (
              <li key={`question-${index}`}>{renderRichText(item, handlePageLinkClick)}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {related.length ? (
        <Section title="Related">
          <ul className="content-list">
            {related.map((item, index) => (
              <li key={`related-${index}`}>{renderRichText(item, handlePageLinkClick)}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {citationEntries.length ? (
        <Section title="Citations">
          <ol className="citation-list">
            {citationEntries.map(([key, value]) => (
              <li id={`citation-${key}`} key={key}>
                <a href={value} target="_blank" rel="noreferrer">
                  {value}
                </a>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </article>
  );
}
