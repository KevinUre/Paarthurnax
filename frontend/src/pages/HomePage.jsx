import { Link } from "react-router-dom";

export default function HomePage() {
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
