"use client";

import { useCallback, useEffect, useState } from "react";
import type { Draft } from "@/lib/api";
import { fetchDrafts } from "@/lib/api";
import DraftStatusBadge from "@/components/DraftStatusBadge";

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  // Pad start of week (Sunday = 0)
  for (let i = 0; i < first.getDay(); i++) {
    days.push(new Date(year, month, -first.getDay() + i + 1));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  // Pad end of week
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1));
  }
  return days;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const res = await fetchDrafts({ status: "scheduled", scheduled_after: start, scheduled_before: end });
      setDrafts(res.drafts);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const prev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else { setMonth(month - 1); } };
  const next = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else { setMonth(month + 1); } };

  // Group drafts by date
  const byDate: Record<string, Draft[]> = {};
  for (const d of drafts) {
    if (!d.scheduled_for) continue;
    const key = d.scheduled_for.slice(0, 10);
    (byDate[key] ??= []).push(d);
  }

  const days = getMonthDays(year, month);
  const todayKey = dateKey(now);
  const monthLabel = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <button onClick={prev} style={{ padding: "6px 14px", background: "#eee", border: "none", borderRadius: "4px", cursor: "pointer" }}>&larr;</button>
        <strong style={{ fontSize: "1.1rem" }}>{monthLabel}</strong>
        <button onClick={next} style={{ padding: "6px 14px", background: "#eee", border: "none", borderRadius: "4px", cursor: "pointer" }}>&rarr;</button>
      </div>

      {loading && <div style={{ color: "#888", padding: "1rem", textAlign: "center" }}>Loading...</div>}

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", background: "#e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} style={{ background: "#f5f5f5", padding: "6px", textAlign: "center", fontSize: "0.75rem", fontWeight: 600 }}>
            {wd}
          </div>
        ))}
        {days.map((day, i) => {
          const key = dateKey(day);
          const isCurrentMonth = day.getMonth() === month;
          const isToday = key === todayKey;
          const entries = byDate[key] ?? [];
          return (
            <div
              key={i}
              style={{
                background: isToday ? "#e8f4ff" : "#fff",
                padding: "4px",
                minHeight: "70px",
                opacity: isCurrentMonth ? 1 : 0.4,
              }}
            >
              <div style={{ fontSize: "0.7rem", fontWeight: isToday ? 700 : 400, marginBottom: "2px" }}>
                {day.getDate()}
              </div>
              {entries.map((d) => (
                <div
                  key={d.id}
                  style={{
                    fontSize: "0.65rem",
                    padding: "2px 4px",
                    marginBottom: "2px",
                    background: "#cce5ff",
                    borderRadius: "3px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={`${d.title} (${d.format})`}
                >
                  {d.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {!loading && drafts.length > 0 && (
        <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#666" }}>
          {drafts.length} scheduled post{drafts.length !== 1 ? "s" : ""} this month
        </div>
      )}
    </div>
  );
}
