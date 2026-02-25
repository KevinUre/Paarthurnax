import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest, AUTH_TOKEN_KEY } from "./api.js";

function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Grassroots Toolkit</p>
      <h1>Hello, world.</h1>
      <p>React + Vite is running.</p>
      <div className="home-actions">
        <Link className="button button-secondary" to="/pages">
          Browse Pages
        </Link>
      </div>
    </section>
  );
}

function canManagePages(user) {
  return user?.role === "curator" || user?.role === "admin";
}

function rankPageMatches(pageIndex, rawQuery, limit = 8) {
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

function getActiveWikiLinkQuery(text, cursorPosition) {
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

  const targetPortion = insideToken.split("|")[0].trim();
  return targetPortion;
}

function WikiLinkTextarea({ label, rows, value, onChange, pageIndex }) {
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const activeQuery = useMemo(
    () => getActiveWikiLinkQuery(value, cursorPosition),
    [value, cursorPosition]
  );

  const matches = useMemo(() => {
    if (!activeQuery) {
      return [];
    }
    return rankPageMatches(pageIndex, activeQuery, 6);
  }, [activeQuery, pageIndex]);

  const showHints = isFocused && activeQuery !== null;

  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => {
          onChange(event);
          setCursorPosition(event.target.selectionStart ?? event.target.value.length);
        }}
        onClick={(event) => setCursorPosition(event.target.selectionStart ?? value.length)}
        onKeyUp={(event) => setCursorPosition(event.currentTarget.selectionStart ?? value.length)}
        onSelect={(event) => setCursorPosition(event.currentTarget.selectionStart ?? value.length)}
        onFocus={(event) => {
          setIsFocused(true);
          setCursorPosition(event.target.selectionStart ?? value.length);
        }}
        onBlur={() => setIsFocused(false)}
      />
      {showHints ? (
        <div className="wikilink-hints">
          <p className="wikilink-hints-title">
            Checking link target for <code>[[{activeQuery || "..."}]]</code>
          </p>
          {activeQuery ? (
            matches.length ? (
              <ul className="wikilink-hints-list">
                {matches.map((item) => (
                  <li key={item.id}>{item.title}</li>
                ))}
              </ul>
            ) : (
              <p className="wikilink-hints-empty">No page title matches that link target.</p>
            )
          ) : (
            <p className="wikilink-hints-empty">Start typing after <code>[[</code> to validate links.</p>
          )}
        </div>
      ) : null}
    </label>
  );
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

function arrayToLines(values) {
  if (!Array.isArray(values)) {
    return "";
  }
  return values.join("\n");
}

function linesToCitations(multiline) {
  const citationUrls = linesToArray(multiline);
  return Object.fromEntries(citationUrls.map((url, index) => [String(index + 1), url]));
}

function citationsToLines(citations) {
  if (!citations || typeof citations !== "object") {
    return "";
  }

  return Object.entries(citations)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, value]) => String(value))
    .join("\n");
}

function NewPageForm({ user, pageIndex }) {
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

function EditPageForm({ user, pageIndex }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [title, setTitle] = useState("");
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
      title: id,
      talkingPoints: linesToArray(talkingPointsText),
      questions: linesToArray(questionsText),
      related: linesToArray(relatedText),
      citations: linesToCitations(citationsText),
    };

    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    try {
      await apiRequest(`/pages/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });
      navigate(`/pages/${encodeURIComponent(id)}`);
    } catch (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm(
      `Delete page "${id}"? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setError("");
    setIsSubmitting(true);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    try {
      await apiRequest(`/pages/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
          <span>Title (read-only, tied to page key)</span>
          <input
            type="text"
            value={title}
            readOnly
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

function PageDetail({ user }) {
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

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const userMenuRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);

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
    let cancelled = false;
    apiRequest("/pages")
      .then((pages) => {
        if (cancelled) {
          return;
        }

        setSearchIndex(
          pages.map((page) => ({
            id: page.id,
            title: String(page.data?.title || page.id),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSearchIndex([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    function handleOutsideClick(event) {
      const insideDesktop = desktopSearchRef.current?.contains(event.target);
      const insideMobile = mobileSearchRef.current?.contains(event.target);
      if (!insideDesktop && !insideMobile) {
        setShowSearchResults(false);
      }

      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(event.target)) {
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
  const searchResults = useMemo(() => {
    return rankPageMatches(searchIndex, searchQuery, 8);
  }, [searchIndex, searchQuery]);

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

  function goToResult(id) {
    navigate(`/pages/${encodeURIComponent(id)}`);
    setShowSearchResults(false);
    setShowMobileSearch(false);
    setSearchQuery("");
  }

  function onSearchSubmit(event) {
    event.preventDefault();
    if (searchResults.length > 0) {
      goToResult(searchResults[0].id);
    }
  }

  return (
    <main className="app-shell">
      <nav className="navbar">
        <Link className="brand" to="/">
          Paarthurnax
        </Link>
        <div className="navbar-search-desktop" ref={desktopSearchRef}>
          <form className="search-form" onSubmit={onSearchSubmit}>
            <input
              className="search-input"
              type="search"
              placeholder="Search page titles..."
              value={searchQuery}
              onFocus={() => setShowSearchResults(true)}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setShowSearchResults(true);
              }}
            />
            {showSearchResults && searchQuery.trim() ? (
              <ul className="search-results" role="listbox">
                {searchResults.length ? (
                  searchResults.map((item) => (
                    <li key={item.id}>
                      <button className="search-result-button" type="button" onClick={() => goToResult(item.id)}>
                        {item.title}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="search-empty">No matches.</li>
                )}
              </ul>
            ) : null}
          </form>
        </div>
        <div className="nav-actions">
          <button
            className="search-toggle"
            type="button"
            aria-label="Toggle search"
            onClick={() => {
              setShowMobileSearch((open) => !open);
              setShowSearchResults(true);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
          </button>
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
        {showMobileSearch ? (
          <div className="navbar-search-mobile" ref={mobileSearchRef}>
            <form className="search-form" onSubmit={onSearchSubmit}>
              <input
                className="search-input"
                type="search"
                autoFocus
                placeholder="Search page titles..."
                value={searchQuery}
                onFocus={() => setShowSearchResults(true)}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setShowSearchResults(true);
                }}
              />
              {showSearchResults && searchQuery.trim() ? (
                <ul className="search-results" role="listbox">
                  {searchResults.length ? (
                    searchResults.map((item) => (
                      <li key={item.id}>
                        <button className="search-result-button" type="button" onClick={() => goToResult(item.id)}>
                          {item.title}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="search-empty">No matches.</li>
                  )}
                </ul>
              ) : null}
            </form>
          </div>
        ) : null}
      </nav>

      <div className="content-wrap">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pages" element={<PagesIndexPage user={user} />} />
          <Route path="/pages/new" element={<NewPageForm user={user} pageIndex={searchIndex} />} />
          <Route path="/pages/:id" element={<PageDetail user={user} />} />
          <Route path="/pages/:id/edit" element={<EditPageForm user={user} pageIndex={searchIndex} />} />
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
            <form
              onSubmit={(event) => {
                event.preventDefault();
                signIn();
              }}
            >
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
                <button className="button button-primary" type="submit" disabled={authDisabled}>
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
