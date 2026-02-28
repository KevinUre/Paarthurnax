import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../api.js";
import {
  arrayToLines,
  canManagePages,
  citationsToLines,
  linesToArray,
  linesToCitations,
} from "../utils/pageData.js";
import WikiLinkTextarea from "../components/WikiLinkTextarea.jsx";

export default function EditPageForm({ user, pageIndex }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [talkingPointsText, setTalkingPointsText] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [relatedText, setRelatedText] = useState("");
  const [citationsText, setCitationsText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/pages/${encodeURIComponent(id)}`)
      .then((result) => {
        const data = result?.data || {};
        setTitle(data.title || result.id || "");
        setDescription(typeof data.description === "string" ? data.description : "");
        setTalkingPointsText(arrayToLines(data.talkingPoints));
        setQuestionsText(arrayToLines(data.questions));
        setRelatedText(arrayToLines(data.related));
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

    setError("");
    setIsSubmitting(true);

    const data = {
      title: normalizedTitle,
      description: description.trim(),
      talkingPoints: linesToArray(talkingPointsText),
      questions: linesToArray(questionsText),
      related: linesToArray(relatedText),
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
      navigate(`/pages/${encodeURIComponent(result.id || normalizedTitle)}`);
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

        <label className="field">
          <span>Description</span>
          <textarea
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description"
          />
        </label>

        <WikiLinkTextarea
          label="Talking Points (one per line)"
          rows={8}
          value={talkingPointsText}
          onChange={(event) => setTalkingPointsText(event.target.value)}
          pageIndex={pageIndex}
        />

        <WikiLinkTextarea
          label="Questions (one per line)"
          rows={8}
          value={questionsText}
          onChange={(event) => setQuestionsText(event.target.value)}
          pageIndex={pageIndex}
        />

        <WikiLinkTextarea
          label="Related (one per line)"
          rows={6}
          value={relatedText}
          onChange={(event) => setRelatedText(event.target.value)}
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
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
