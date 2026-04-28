import { Link } from "react-router-dom";

export default function HomePage({ onBrowsePages }) {
  return (
    <section className="hero">
      <p className="eyebrow">Michiganders Against Datacenters</p>
      <h1>Paarthurnax</h1>
      <p>In the mythos of the Elder Scrolls, the dragon Paarthurnax betrayed his kind by teaching mankind how to do the magic of the dragons - the thu'um - which they used to end the tyrannical draconic rule over the lands of Tamreil. Likewise, this site was made by a tech insider with the purpose of informing the populace about its true nature and costs. This site is the culmination of Michiganders Against Data Center's research and information efforts. Within this tool you will find all of our research-backed talking points on datacenter minutiae, what questions to ask based on what you hear these companies claim, and how to push back against the sprawl of datacenter construction projects in your area. Armed with knowledge, the people can fight any dragon, no matter the size. </p>
      <div className="home-actions">
        <Link
          className="button button-secondary"
          to="/pages"
          state={{ pageHistory: [] }}
          onClick={onBrowsePages}
        >
          Browse All Pages
        </Link>
      </div>
    </section>
  );
}
