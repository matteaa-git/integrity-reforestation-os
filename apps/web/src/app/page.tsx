export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Instagram Growth OS</h1>
      <p>Content production and paid-growth operating system for Integrity Reforestation.</p>
      <hr />
      <h2>Daily Targets</h2>
      <ul>
        <li>10 stories / day</li>
        <li>3 reels / day</li>
        <li>1 carousel / day</li>
        <li>Profitable ad testing</li>
      </ul>
      <h2>Content Builders</h2>
      <ul>
        <li><a href="/stories/new" style={{ color: "#0070f3" }}>New Story</a></li>
        <li><a href="/reels/new" style={{ color: "#0070f3" }}>New Reel</a></li>
        <li><a href="/carousels/new" style={{ color: "#0070f3" }}>New Carousel</a></li>
      </ul>
      <h2>Workflow</h2>
      <ul>
        <li><a href="/queue" style={{ color: "#0070f3" }}>Approval Queue</a></li>
        <li><a href="/calendar" style={{ color: "#0070f3" }}>Content Calendar</a></li>
      </ul>
      <h2>Paid Growth</h2>
      <ul>
        <li><a href="/ad-lab" style={{ color: "#0070f3" }}>Ad Creative Lab</a></li>
      </ul>
      <h2>Tools</h2>
      <ul>
        <li><a href="/assets" style={{ color: "#0070f3" }}>Asset Browser</a></li>
      </ul>
    </main>
  );
}
