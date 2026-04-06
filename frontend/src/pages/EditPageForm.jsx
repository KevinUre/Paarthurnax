import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../api.js";
import {
  canManagePages,
  citationsToLines,
  linesToCitations,
} from "../utils/pageData.js";
import WikiLinkTextarea from "../components/WikiLinkTextarea.jsx";

export default function EditPageForm({ user, pageIndex }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [citationsText, setCitationsText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/pages/${encodeURIComponent(id)}`)
      .then((result) => {
        const data = result?.data || {};
        setTitle(data.title || result.id || "");
        setBody(typeof data.body === "string" ? data.body : "");
        setCitationsText(citationsToLines(data.citations));
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (!canManagePages(user)) {
    return (
      <section className="hero">
        <h1>Not authorized</h1>
        <p className="error">You must be signed in as curator or admin to edit pages.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="hero">
        <p>Loading page...</p>
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

    const buttonName = event.nativeEvent.submitter.name

    setError("");
    setIsSubmitting(true);

    const data = {
      title: normalizedTitle,
      body,
      citations: linesToCitations(citationsText),
    };

    try {
      const result = await apiRequest(`/pages/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        requireAuth: true,
        body: JSON.stringify({ data }),
      });
      if (buttonName === "Apply") { navigate(`/pages/${encodeURIComponent(result.id || normalizedTitle)}`); }
      else { setIsSubmitting(false); }
    } catch (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm(`Delete page "${id}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await apiRequest(`/pages/${encodeURIComponent(id)}`, {
        method: "DELETE",
        requireAuth: true,
      });
      navigate("/pages");
    } catch (deleteError) {
      setError(deleteError.message);
      setIsSubmitting(false);
    }
  }

  return (
    <section className="detail-page">
      <header className="detail-header">
        <h1>Edit Page</h1>
        <p>Page key: {id}</p>
      </header>

      <form className="page-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Title (also updates page key)</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
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
          <button className="button button-danger" type="button" onClick={onDelete} disabled={isSubmitting}>
            Delete Page
          </button>
          <Link className="button button-secondary" to={`/pages/${encodeURIComponent(id)}`}>
            Cancel
          </Link>
          <button className="button button-primary" type="submit" name="Save" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <button className="button button-primary" type="submit" name="Apply" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Apply Changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
