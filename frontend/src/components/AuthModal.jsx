export default function AuthModal({
  show,
  onClose,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  errorMessage,
  authDisabled,
  onSignIn,
  onSignUp,
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
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
            onSignIn();
          }}
        >
          <label className="field">
            <span>Username</span>
            <input
              autoFocus
              type="text"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="yourname"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="password"
            />
          </label>
          {errorMessage ? <p className="error">{errorMessage}</p> : null}
          <div className="button-row">
            <button className="button button-secondary" type="button" onClick={onSignUp} disabled={authDisabled}>
              Sign Up
            </button>
            <button className="button button-primary" type="submit" disabled={authDisabled}>
              Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
