import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { canManagePages } from "../utils/pageData.js";
import { apiRequest } from "../api.js";

export default function PagesIndexPage({ user }) {
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
              <Link to={`/pages/${encodeURIComponent(page.id)}`}>{page.data?.title || page.id}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
