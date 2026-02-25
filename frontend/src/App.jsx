import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, AUTH_TOKEN_KEY } from "./api.js";

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
        <a className="brand" href="/">
          Paarthurnax
        </a>
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

      <section className="hero">
        <p className="eyebrow">Grassroots Toolkit</p>
        <h1>Hello, world.</h1>
        <p>React + Vite is running.</p>
      </section>

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
