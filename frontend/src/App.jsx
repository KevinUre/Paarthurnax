import { useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, AUTH_TOKEN_KEY } from "./api.js";
import { rankPageMatches } from "./utils/pageData.js";
import NavBar from "./components/NavBar.jsx";
import AuthModal from "./components/AuthModal.jsx";
import HomePage from "./pages/HomePage.jsx";
import PagesIndexPage from "./pages/PagesIndexPage.jsx";
import NewPageForm from "./pages/NewPageForm.jsx";
import PageDetail from "./pages/PageDetail.jsx";
import EditPageForm from "./pages/EditPageForm.jsx";
import AdminPage from "./pages/AdminPage.jsx";

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

  const searchResults = useMemo(
    () => rankPageMatches(searchIndex, searchQuery, 8),
    [searchIndex, searchQuery]
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
      <NavBar
        user={user}
        isCheckingSession={isCheckingSession}
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
          <Route path="/" element={<HomePage />} />
          <Route path="/pages" element={<PagesIndexPage user={user} />} />
          <Route path="/pages/new" element={<NewPageForm user={user} pageIndex={searchIndex} />} />
          <Route path="/pages/:id" element={<PageDetail user={user} />} />
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
