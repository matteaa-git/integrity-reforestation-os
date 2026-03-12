import ApprovalQueue from "@/components/ApprovalQueue";

export default function QueuePage() {
  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Approval Queue</h1>
        <div style={{ display: "flex", gap: "12px", fontSize: "0.85rem" }}>
          <a href="/calendar" style={{ color: "#0070f3" }}>Calendar</a>
          <a href="/" style={{ color: "#0070f3" }}>&larr; Home</a>
        </div>
      </div>
      <ApprovalQueue />
    </main>
  );
}
