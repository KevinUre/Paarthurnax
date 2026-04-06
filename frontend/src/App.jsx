import { useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  apiRequest,
  clearAuthTokens,
  getAccessToken,
  setAuthTokens,
} from "./api.js";
import Fuse from "fuse.js";
import NavBar from "./components/NavBar.jsx";
import AuthModal from "./components/AuthModal.jsx";
import HomePage from "./pages/HomePage.jsx";
import PagesIndexPage from "./pages/PagesIndexPage.jsx";
import NewPageForm from "./pages/NewPageForm.jsx";
import PageDetail from "./pages/PageDetail.jsx";
import EditPageForm from "./pages/EditPageForm.jsx";
import AdminPage from "./pages/AdminPage.jsx";

const THEME_STORAGE_KEY = "paarthurnax-theme";

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageHistory = useMemo(() => {
    if (Array.isArray(location.state?.pageHistory)) {
      return location.state.pageHistory;
    }
    return [];
  }, [location.state]);

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
  const [theme, setTheme] = useState(getInitialTheme);

  const userMenuRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);

  useEffect(() => {
    const storedToken = getAccessToken();
    if (!storedToken) {
      setIsCheckingSession(false);
      return;
    }

    apiRequest("/auth/me", {
      requireAuth: true,
    })
      .then((result) => {
        setUser(result.user);
      })
      .catch(() => {
        clearAuthTokens();
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
            description: String(page.data?.description || ""),
            talkingPoints: Array.isArray(page.data?.talkingPoints)
              ? page.data.talkingPoints.join(" ")
              : "",
            questions: Array.isArray(page.data?.questions)
              ? page.data.questions.join(" ")
              : "",
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
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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

  const searchEngine = useMemo(() => {
    if (!searchIndex.length) {
      return null;
    }
    return new Fuse(searchIndex, {
      keys: ["title", "description", "talkingPoints", "questions"],
      threshold: 0.35,
      ignoreLocation: true,
      includeScore: true,
    });
  }, [searchIndex]);

  const searchResults = useMemo(
    () => {
      const query = searchQuery.trim();
      if (!query || !searchEngine) {
        return [];
      }
      return searchEngine.search(query, { limit: 8 }).map((result) => result.item);
    },
    [searchEngine, searchQuery]
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

      setAuthTokens(result.accessToken, result.refreshToken);
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

  async function logout() {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        requireAuth: true,
      });
    } catch (_error) {
      // Clear local auth state even if server-side logout fails.
    }

    clearAuthTokens();
    setUser(null);
    setShowUserMenu(false);
    setUsername("");
    setPassword("");
    setErrorMessage("");
  }

  function goHome() {
    setShowSearchResults(false);
    setShowMobileSearch(false);
    setSearchQuery("");
  }

  function goToResult(id) {
    navigate(`/pages/${encodeURIComponent(id)}`, {
      state: { pageHistory: [] },
    });
    setShowSearchResults(false);
    setShowMobileSearch(false);
    setSearchQuery("");
  }

  function goToPagesIndex() {}

  function goToPageFromList() {}

  function goToPageFromDetail(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }

    navigate(`/pages/${encodeURIComponent(targetId)}`, {
      state: { pageHistory: [...pageHistory, sourceId] },
    });
  }

  function popHistoryToPage(targetId) {
    const targetIndex = pageHistory.lastIndexOf(targetId);
    navigate(`/pages/${encodeURIComponent(targetId)}`, {
      state: {
        pageHistory: targetIndex < 0 ? [] : pageHistory.slice(0, targetIndex),
      },
    });
  }

  function onSearchSubmit(event) {
    event.preventDefault();
    if (searchResults.length > 0) {
      goToResult(searchResults[0].id);
    }
  }

  return (
    <main className="app-shell">
      <NavBar
        user={user}
        isCheckingSession={isCheckingSession}
        theme={theme}
        onToggleTheme={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
        showUserMenu={showUserMenu}
        onToggleUserMenu={() => setShowUserMenu((current) => !current)}
        onLogout={logout}
        userMenuRef={userMenuRef}
        searchQuery={searchQuery}
        onSearchQueryChange={(value) => {
          setSearchQuery(value);
          setShowSearchResults(true);
        }}
        showSearchResults={showSearchResults}
        onSearchFocus={() => setShowSearchResults(true)}
        onSearchSubmit={onSearchSubmit}
        searchResults={searchResults}
        onGoToResult={goToResult}
        onGoHome={goHome}
        showMobileSearch={showMobileSearch}
        onToggleMobileSearch={() => {
          setShowMobileSearch((open) => !open);
          setShowSearchResults(true);
        }}
        desktopSearchRef={desktopSearchRef}
        mobileSearchRef={mobileSearchRef}
        onOpenAuthModal={() => {
          setErrorMessage("");
          setShowAuthModal(true);
        }}
      />

      <div className="content-wrap">
        <Routes>
          <Route path="/" element={<HomePage onBrowsePages={goToPagesIndex} />} />
          <Route path="/pages" element={<PagesIndexPage user={user} onOpenPage={goToPageFromList} />} />
          <Route path="/pages/new" element={<NewPageForm user={user} pageIndex={searchIndex} />} />
          <Route
            path="/pages/:id"
            element={
              <PageDetail
                user={user}
                pageHistory={pageHistory}
                pageIndex={searchIndex}
                onOpenRelatedPage={goToPageFromDetail}
                onPopHistoryToPage={popHistoryToPage}
              />
            }
          />
          <Route path="/pages/:id/edit" element={<EditPageForm user={user} pageIndex={searchIndex} />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>

      <footer className="site-footer">
        <a href="https://linktr.ee/michiganbemad" target="_blank" rel="noreferrer">
          Get Connected
        </a>
        <a href="https://github.com/KevinUre/Paarthurnax/issues/new" target="_blank" rel="noreferrer">
          Notice an Issue?
        </a>
      </footer>

      <AuthModal
        show={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        username={username}
        onUsernameChange={setUsername}
        password={password}
        onPasswordChange={setPassword}
        errorMessage={errorMessage}
        authDisabled={authDisabled}
        onSignIn={signIn}
        onSignUp={signUp}
      />
    </main>
  );
}
