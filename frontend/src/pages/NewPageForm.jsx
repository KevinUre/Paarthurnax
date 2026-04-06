import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import { canManagePages, linesToCitations } from "../utils/pageData.js";
import WikiLinkTextarea from "../components/WikiLinkTextarea.jsx";

export default function NewPageForm({ user, pageIndex }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [citationsText, setCitationsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!canManagePages(user)) {
    return (
      <section className="hero">
        <h1>Not authorized</h1>
        <p className="error">You must be signed in as curator or admin to create pages.</p>
      </section>
    );
  }

  async function onSubmit(event) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError("Title is required.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const data = {
      title: normalizedTitle,
      body,
      citations: linesToCitations(citationsText),
    };

    try {
      await apiRequest("/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        requireAuth: true,
        body: JSON.stringify({ id: normalizedTitle, data }),
      });
      navigate("/pages");
    } catch (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
    }
  }

  return (
    <section className="detail-page">
      <header className="detail-header">
        <h1>Create Page</h1>
      </header>

      <form className="page-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Title (also used as page key)</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Page Title"
            required
          />
        </label>

        <WikiLinkTextarea
          label={(
            <>
              Body - supports <code>Markdown</code>, <code>[[Page Links]]</code>, <code>[[Page|Alias]]</code>, and citation refs like <code>[1]</code>
            </>
          )}
          rows={18}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          pageIndex={pageIndex}
        />

        <label className="field">
          <span>Citations URLs (one per line, auto-numbered)</span>
          <textarea
            rows={8}
            value={citationsText}
            onChange={(event) => setCitationsText(event.target.value)}
          />
        </label>

        {error ? <p className="error-toast">{error}</p> : null}

        <div className="button-row">
          <Link className="button button-secondary" to="/pages">
            Cancel
          </Link>
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Page"}
          </button>
        </div>
      </form>
    </section>
  );
}
