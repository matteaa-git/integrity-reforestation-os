import CalendarView from "@/components/CalendarView";

export default function CalendarPage() {
  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Content Calendar</h1>
        <div style={{ display: "flex", gap: "12px", fontSize: "0.85rem" }}>
          <a href="/queue" style={{ color: "#0070f3" }}>Queue</a>
          <a href="/" style={{ color: "#0070f3" }}>&larr; Home</a>
        </div>
      </div>
      <CalendarView />
    </main>
  );
}
