import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AUTH_TOKEN_KEY, apiRequest } from "../api.js";
import { canManagePages, linesToArray, linesToCitations } from "../utils/pageData.js";
import WikiLinkTextarea from "../components/WikiLinkTextarea.jsx";

export default function NewPageForm({ user, pageIndex }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [talkingPointsText, setTalkingPointsText] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [relatedText, setRelatedText] = useState("");
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
      talkingPoints: linesToArray(talkingPointsText),
      questions: linesToArray(questionsText),
      related: linesToArray(relatedText),
      citations: linesToCitations(citationsText),
    };

    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    try {
      await apiRequest("/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
        <p>Each line in list fields becomes one item.</p>
      </header>

      <form className="page-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Title (also used as page key)</span>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Closed Loop Cooling"
            required
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
