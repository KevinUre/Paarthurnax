import { Link } from "react-router-dom";

export default function NavBar({
  user,
  isCheckingSession,
  theme,
  onToggleTheme,
  showUserMenu,
  onToggleUserMenu,
  onLogout,
  userMenuRef,
  searchQuery,
  onSearchQueryChange,
  showSearchResults,
  onSearchFocus,
  onSearchSubmit,
  searchResults,
  onGoToResult,
  onGoHome,
  showMobileSearch,
  onToggleMobileSearch,
  desktopSearchRef,
  mobileSearchRef,
  onOpenAuthModal,
}) {
  return (
    <nav className="navbar">
      <Link className="brand" to="/" onClick={onGoHome}>
        Paarthurnax
      </Link>

      <div className="navbar-search-desktop" ref={desktopSearchRef}>
        <form className="search-form" onSubmit={onSearchSubmit}>
          <input
            className="search-input"
            type="search"
            placeholder="Search page titles..."
            value={searchQuery}
            onFocus={onSearchFocus}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
          {showSearchResults && searchQuery.trim() ? (
            <ul className="search-results" role="listbox">
              {searchResults.length ? (
                searchResults.map((item) => (
                  <li key={item.id}>
                    <button className="search-result-button" type="button" onClick={() => onGoToResult(item.id)}>
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
          onClick={onToggleMobileSearch}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.65" y1="16.65" x2="21" y2="21" />
          </svg>
        </button>
        <button
          className="theme-toggle"
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={onToggleTheme}
        >
          <span className="theme-toggle-track" aria-hidden="true">
            <span className="theme-toggle-icon theme-toggle-icon-sun">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="1.5" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22.5" />
                <line x1="1.5" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22.5" y2="12" />
                <line x1="4.6" y1="4.6" x2="7.1" y2="7.1" />
                <line x1="16.9" y1="16.9" x2="19.4" y2="19.4" />
                <line x1="16.9" y1="7.1" x2="19.4" y2="4.6" />
                <line x1="4.6" y1="19.4" x2="7.1" y2="16.9" />
              </svg>
            </span>
            <span className="theme-toggle-thumb" />
            <span className="theme-toggle-icon theme-toggle-icon-moon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a7 7 0 0 0 10.2 10.2Z" />
              </svg>
            </span>
          </span>
        </button>
        {isCheckingSession ? null : user ? (
          <div className="user-menu-wrap" ref={userMenuRef}>
            <button className="user-pill" type="button" onClick={onToggleUserMenu}>
              {user.username}
            </button>
            {showUserMenu ? (
              <div className="user-menu" role="menu">
                <button className="user-menu-item" type="button" onClick={onLogout}>
                  Log Out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button className="button button-primary" type="button" onClick={onOpenAuthModal}>
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
              onFocus={onSearchFocus}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
            {showSearchResults && searchQuery.trim() ? (
              <ul className="search-results" role="listbox">
                {searchResults.length ? (
                  searchResults.map((item) => (
                    <li key={item.id}>
                      <button className="search-result-button" type="button" onClick={() => onGoToResult(item.id)}>
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
  );
}
