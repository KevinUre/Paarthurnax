import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { apiRequest, AUTH_TOKEN_KEY } from "./api.js";

function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Grassroots Toolkit</p>
      <h1>Hello, world.</h1>
      <p>React + Vite is running.</p>
    </section>
  );
}

function canManagePages(user) {
  return user?.role === "curator" || user?.role === "admin";
}

function PagesIndexPage({ user }) {
  const [pages, setPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/pages")
      .then((result) => setPages(result))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section className="hero">
      <div className="hero-header">
        <div>
          <p className="eyebrow">Pages</p>
          <h1>All Pages</h1>
        </div>
        {canManagePages(user) ? (
          <Link className="button button-primary" to="/pages/new">
            New Page
          </Link>
        ) : null}
      </div>
      {isLoading ? <p>Loading pages...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!isLoading && !error ? (
        <ul className="content-list">
          {pages.map((page) => (
            <li key={page.id}>
              <Link to={`/pages/${encodeURIComponent(page.id)}`}>
                {page.data?.title || page.id}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function linesToArray(multiline) {
  return multiline
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function NewPageForm({ user }) {
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

    const citationUrls = linesToArray(citationsText);
    const citations = Object.fromEntries(
      citationUrls.map((url, index) => [String(index + 1), url])
    );

    const data = {
      title: normalizedTitle,
      talkingPoints: linesToArray(talkingPointsText),
      questions: linesToArray(questionsText),
      related: linesToArray(relatedText),
      citations,
    };

    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    try {
      await apiRequest("/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: normalizedTitle,
          data,
        }),
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

        <label className="field">
          <span>Talking Points (one per line)</span>
          <textarea
            rows={8}
            value={talkingPointsText}
            onChange={(event) => setTalkingPointsText(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Questions (one per line)</span>
          <textarea
            rows={8}
            value={questionsText}
            onChange={(event) => setQuestionsText(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Related (one per line)</span>
          <textarea
            rows={6}
            value={relatedText}
            onChange={(event) => setRelatedText(event.target.value)}
          />
        </label>

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

function PageDetail() {
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
  const citations = data.citations && typeof data.citations === "object" ? data.citations : {};

  const citationEntries = Object.entries(citations).sort(([a], [b]) =>
    Number(a) - Number(b)
  );

  return (
    <article className="detail-page">
      <header className="detail-header">
        <h1>{data.title || page.id}</h1>
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

export default function App() {
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!storedToken) {
      setIsCheckingSession(false);
      return;
    }

    apiRequest("/auth/me", {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((result) => {
        setUser(result.user);
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      })
      .finally(() => {
        setIsCheckingSession(false);
      });
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!showUserMenu) {
        return;
      }

      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showUserMenu]);

  const authDisabled = useMemo(
    () => isSubmitting || !username.trim() || !password,
    [isSubmitting, username, password]
  );

  async function signIn() {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await apiRequest("/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      localStorage.setItem(AUTH_TOKEN_KEY, result.token);
      setUser(result.user);
      setShowAuthModal(false);
      setPassword("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signUp() {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await apiRequest("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      await signIn();
    } catch (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
    }
  }

  function openAuthModal() {
    setErrorMessage("");
    setShowAuthModal(true);
  }

  function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
    setShowUserMenu(false);
    setUsername("");
    setPassword("");
    setErrorMessage("");
  }

  return (
    <main className="app-shell">
      <nav className="navbar">
        <Link className="brand" to="/">
          Paarthurnax
        </Link>
        <div className="nav-links">
          <Link to="/pages">Pages</Link>
        </div>
        <div className="nav-actions">
          {isCheckingSession ? null : user ? (
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button
                className="user-pill"
                type="button"
                onClick={() => setShowUserMenu((current) => !current)}
              >
                {user.username}
              </button>
              {showUserMenu ? (
                <div className="user-menu" role="menu">
                  <button className="user-menu-item" type="button" onClick={logout}>
                    Log Out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button className="button button-primary" type="button" onClick={openAuthModal}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      <div className="content-wrap">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pages" element={<PagesIndexPage user={user} />} />
          <Route path="/pages/new" element={<NewPageForm user={user} />} />
          <Route path="/pages/:id" element={<PageDetail />} />
        </Routes>
      </div>

      {showAuthModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowAuthModal(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in or sign up"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Welcome back</h2>
            <label className="field">
              <span>Username</span>
              <input
                autoFocus
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="yourname"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="password"
              />
            </label>
            {errorMessage ? <p className="error">{errorMessage}</p> : null}
            <div className="button-row">
              <button className="button button-secondary" type="button" onClick={signUp} disabled={authDisabled}>
                Sign Up
              </button>
              <button className="button button-primary" type="button" onClick={signIn} disabled={authDisabled}>
                Sign In
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
