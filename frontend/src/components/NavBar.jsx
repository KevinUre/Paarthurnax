import { Link } from "react-router-dom";

export default function NavBar({
  user,
  isCheckingSession,
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
  showMobileSearch,
  onToggleMobileSearch,
  desktopSearchRef,
  mobileSearchRef,
  onOpenAuthModal,
}) {
  return (
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
