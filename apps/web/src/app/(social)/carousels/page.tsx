"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchDrafts, deleteDraft, type Draft } from "@/lib/api";

export default function CarouselsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchDrafts({ format: "carousel" })
      .then((r) => setDrafts(r.drafts))
      .catch(() => setDrafts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this carousel?")) return;
    await deleteDraft(id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>Carousels</h1>
        <Link
          href="/carousels/new"
          style={{ background: "#7c6ef7", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          + New Carousel
        </Link>
      </div>

      {loading && (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading…</p>
      )}

      {!loading && drafts.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.3)" }}>
          <p style={{ fontSize: 16, marginBottom: 12 }}>No carousels yet.</p>
          <Link href="/carousels/new" style={{ color: "#7c6ef7", fontSize: 14 }}>Create your first carousel →</Link>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {drafts.map((d) => {
          const slideCount = (d.metadata?.slides as unknown[])?.length ?? 0;
          const updatedAt = d.updated_at ? new Date(d.updated_at).toLocaleDateString() : "";
          return (
            <div
              key={d.id}
              style={{ background: "#161625", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>{d.title || "Untitled Carousel"}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                  {slideCount} slide{slideCount !== 1 ? "s" : ""} · {d.status} {updatedAt ? `· ${updatedAt}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link
                  href={`/carousels/new?draft=${d.id}`}
                  style={{ flex: 1, textAlign: "center", background: "#7c6ef7", color: "#fff", padding: "8px 0", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                >
                  Open
                </Link>
                <button
                  onClick={() => handleDelete(d.id)}
                  style={{ background: "rgba(255,60,60,0.15)", border: "1px solid rgba(255,60,60,0.3)", color: "#ff6b6b", padding: "8px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
