import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api.js";
import { canManagePages } from "../utils/pageData.js";

function renderRichText(text) {
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
        <Link key={`wikilink-${index}`} to={`/pages/${encodeURIComponent(target)}`}>
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

export default function PageDetail({ user }) {
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

  return (
    <article className="detail-page">
      <header className="detail-header detail-header-row">
        <h1>{data.title || page.id}</h1>
        {canManagePages(user) ? (
          <Link className="button button-secondary" to={`/pages/${encodeURIComponent(page.id)}/edit`}>
            Edit
          </Link>
        ) : null}
      </header>

      <Section title="Talking Points">
        {talkingPoints.length ? (
          <ul className="content-list">
            {talkingPoints.map((item, index) => (
              <li key={`point-${index}`}>{renderRichText(item)}</li>
            ))}
          </ul>
        ) : (
          <p>No talking points yet.</p>
        )}
      </Section>

      <Section title="Questions">
        {questions.length ? (
          <ul className="content-list">
            {questions.map((item, index) => (
              <li key={`question-${index}`}>{renderRichText(item)}</li>
            ))}
          </ul>
        ) : (
          <p>No questions yet.</p>
        )}
      </Section>

      <Section title="Related">
        {related.length ? (
          <ul className="content-list">
            {related.map((item, index) => (
              <li key={`related-${index}`}>{renderRichText(item)}</li>
            ))}
          </ul>
        ) : (
          <p>No related pages yet.</p>
        )}
      </Section>

      <Section title="Citations">
        {citationEntries.length ? (
          <ol className="citation-list">
            {citationEntries.map(([key, value]) => (
              <li id={`citation-${key}`} key={key}>
                <a href={value} target="_blank" rel="noreferrer">
                  [{key}] {value}
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p>No citations yet.</p>
        )}
      </Section>
    </article>
  );
}
