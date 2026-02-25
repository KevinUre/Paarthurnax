import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Michiganders Against Datacenters</p>
      <h1>Paarthurnax</h1>
      <p>Welcome to Paarthurnax, the culmination of MAD's research and information efforts. Within this tool you will find all of our research-backed talking points on datacenter minutiae, what questions to ask based on what you hear these companies claim, and how to push back against the sprawl of datacenter construction projects in your area.</p>
      <div className="home-actions">
        <Link className="button button-secondary" to="/pages">
          Browse All Pages
        </Link>
      </div>
    </section>
  );
}
