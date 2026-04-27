"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type PortalTab = "production" | "earnings";

interface ProductionEntry {
  id: string;
  date: string;
  crew_boss: string | null;
  project: string | null;
  block: string | null;
  camp: string | null;
  shift: string | null;
  total_trees: number;
  total_earnings: number;
  total_with_vac: number;
  vac_pay: number;
  hours_worked: number;
  production: { species: string; code: string; trees: number; rate_per_tree: number; earnings: number }[];
}

function fmt(n: number) {
  return n.toLocaleString("en-CA");
}
function fmtC(n: number) {
  return "$" + Number(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function startOfYear() { return `${new Date().getFullYear()}-01-01`; }

export default function PlanterPortal({ tab: initialTab }: { tab: PortalTab }) {
  const supabase = createClient();
  const [tab, setTab]           = useState<PortalTab>(initialTab);
  const [entries, setEntries]   = useState<ProductionEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [myName, setMyName]     = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(startOfYear());
  const [dateTo, setDateTo]     = useState(todayStr());

  // Load planter's name and entries
  useEffect(() => {
    async function load() {
      setLoading(true);

      // Get current user's name
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const name = profile?.full_name ?? null;
      setMyName(name);

      if (!name) { setLoading(false); return; }

      // Fetch their production entries
      const { data } = await supabase
        .from("production_entries")
        .select("id, date, crew_boss, project, block, camp, shift, total_trees, total_earnings, total_with_vac, vac_pay, hours_worked, production")
        .eq("employee_name", name)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });

      setEntries((data ?? []) as ProductionEntry[]);
      setLoading(false);
    }
    load();
  }, [dateFrom, dateTo]);

  // ── Derived totals ──────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const totalTrees    = entries.reduce((s, e) => s + (e.total_trees ?? 0), 0);
    const totalEarnings = entries.reduce((s, e) => s + Number(e.total_earnings ?? 0), 0);
    const totalWithVac  = entries.reduce((s, e) => s + Number(e.total_with_vac ?? 0), 0);
    const totalVac      = entries.reduce((s, e) => s + Number(e.vac_pay ?? 0), 0);
    const totalHours    = entries.reduce((s, e) => s + Number(e.hours_worked ?? 0), 0);
    const days          = new Set(entries.map(e => e.date)).size;
    const avgPerDay     = days > 0 ? totalTrees / days : 0;
    return { totalTrees, totalEarnings, totalWithVac, totalVac, totalHours, days, avgPerDay };
  }, [entries]);

  const speciesSummary = useMemo(() => {
    const map = new Map<string, { code: string; trees: number; earnings: number; rate: number }>();
    for (const e of entries) {
      for (const l of (e.production ?? [])) {
        const s = map.get(l.species) ?? { code: l.code, trees: 0, earnings: 0, rate: l.rate_per_tree };
        s.trees    += l.trees ?? 0;
        s.earnings += Number(l.earnings ?? 0);
        map.set(l.species, s);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1].trees - a[1].trees)
      .map(([species, v]) => ({ species, ...v }));
  }, [entries]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inputCls = "bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 transition-colors";

  return (
    <div className="flex flex-col h-full">

      {/* Tab bar */}
      <div className="flex items-center border-b border-border px-6 bg-surface shrink-0">
        {([
          { key: "production", label: "My Production" },
          { key: "earnings",   label: "My Earnings"   },
        ] as { key: PortalTab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Date range filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs font-semibold text-text-primary">
              {myName ?? "Loading…"}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-text-tertiary uppercase tracking-widest font-semibold">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
              <label className="text-[10px] text-text-tertiary uppercase tracking-widest font-semibold">To</label>
              <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className={inputCls} />
            </div>
          </div>

          {/* No name warning */}
          {!myName && !loading && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-5 py-4 text-xs text-amber-400">
              Your profile doesn&apos;t have a name set. Ask your admin to add your full name to your profile so your production records can be matched.
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Trees",    value: fmt(totals.totalTrees),         accent: true },
              { label: "Planting Days",  value: String(totals.days) },
              { label: "Avg Trees / Day", value: fmt(Math.round(totals.avgPerDay)) },
              { label: "Hours Worked",   value: `${totals.totalHours.toFixed(1)} h` },
            ].map(k => (
              <div key={k.label} className={`rounded-xl border p-4 ${k.accent ? "border-primary/30 bg-primary/5" : "border-border bg-surface"}`}>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{k.label}</div>
                <div className={`text-xl font-bold mt-1 ${k.accent ? "text-primary" : "text-text-primary"}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-text-tertiary">Loading your records…</div>
          ) : entries.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
              <div className="text-3xl opacity-20 mb-2">⬡</div>
              <div className="text-xs text-text-tertiary">No production entries found for this date range.</div>
            </div>
          ) : (

            <>
              {/* ── PRODUCTION TAB ── */}
              {tab === "production" && (
                <div className="space-y-4">

                  {/* Species breakdown */}
                  {speciesSummary.length > 0 && (
                    <div className="bg-surface border border-border rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                        <div className="text-xs font-semibold text-text-primary">Species Totals</div>
                      </div>
                      <div className="p-4 flex flex-wrap gap-2">
                        {speciesSummary.map(s => (
                          <div key={s.species} className="bg-surface-secondary border border-border rounded-lg px-3 py-2 min-w-[90px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold font-mono text-text-secondary">{s.code}</span>
                              <span className="text-[9px] text-text-tertiary">${s.rate.toFixed(2)}</span>
                            </div>
                            <div className="text-sm font-bold text-text-primary">{fmt(s.trees)}</div>
                            <div className="text-[10px] text-text-tertiary">{fmtC(s.earnings)}</div>
                          </div>
                        ))}
                        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 min-w-[90px]">
                          <div className="text-[10px] font-bold text-primary mb-1">TOTAL</div>
                          <div className="text-sm font-bold text-text-primary">{fmt(totals.totalTrees)}</div>
                          <div className="text-[10px] text-text-tertiary">{fmtC(totals.totalEarnings)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Daily log */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                      <div className="text-xs font-semibold text-text-primary">Daily Log</div>
                      <span className="text-[10px] text-text-tertiary">{entries.length} entries</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-surface-secondary/50">
                            {["Date", "Block", "Project", "Crew Boss", "Trees", "Species"].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {entries.map(e => (
                            <tr key={e.id} className="hover:bg-surface-secondary/30 transition-colors">
                              <td className="px-4 py-3 font-mono text-text-primary whitespace-nowrap">{e.date}</td>
                              <td className="px-4 py-3 text-text-secondary">{e.block ?? <span className="opacity-30">—</span>}</td>
                              <td className="px-4 py-3 text-text-secondary">{e.project ?? <span className="opacity-30">—</span>}</td>
                              <td className="px-4 py-3 text-text-secondary">{e.crew_boss ?? <span className="opacity-30">—</span>}</td>
                              <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmt(e.total_trees ?? 0)}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {(e.production ?? []).filter(l => l.trees > 0).map((l, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-surface-secondary border border-border text-[9px] font-medium text-text-secondary">
                                      <span className="font-mono font-bold text-text-primary">{l.code}</span>
                                      <span>{fmt(l.trees)}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── EARNINGS TAB ── */}
              {tab === "earnings" && (
                <div className="space-y-4">

                  {/* Earnings summary card */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                      <div className="text-xs font-semibold text-text-primary">Pay Summary</div>
                      <div className="text-[10px] text-text-tertiary mt-0.5">
                        {dateFrom} → {dateTo} · {totals.days} day{totals.days !== 1 ? "s" : ""} worked
                      </div>
                    </div>
                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Piece Rate Earnings", value: fmtC(totals.totalEarnings), accent: false },
                        { label: "Vacation Pay (4%)",   value: fmtC(totals.totalVac),      accent: false },
                        { label: "Total w/ Vac Pay",    value: fmtC(totals.totalWithVac),  accent: true  },
                        { label: "Trees Planted",       value: fmt(totals.totalTrees),      accent: false },
                      ].map(k => (
                        <div key={k.label} className={`rounded-xl border p-4 ${k.accent ? "border-primary/30 bg-primary/5" : "border-border bg-surface-secondary/40"}`}>
                          <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{k.label}</div>
                          <div className={`text-lg font-bold mt-1 ${k.accent ? "text-primary" : "text-text-primary"}`}>{k.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Species earnings breakdown */}
                  {speciesSummary.length > 0 && (
                    <div className="bg-surface border border-border rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                        <div className="text-xs font-semibold text-text-primary">Earnings by Species</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-surface-secondary/50">
                              {["Species", "Code", "Trees", "Rate / Tree", "Earnings"].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {speciesSummary.map(s => (
                              <tr key={s.species} className="hover:bg-surface-secondary/30 transition-colors">
                                <td className="px-4 py-3 text-text-primary font-medium">{s.species}</td>
                                <td className="px-4 py-3 font-mono font-bold text-text-secondary">{s.code}</td>
                                <td className="px-4 py-3 font-mono text-text-primary">{fmt(s.trees)}</td>
                                <td className="px-4 py-3 font-mono text-text-secondary">${s.rate.toFixed(4)}</td>
                                <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmtC(s.earnings)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border bg-surface-secondary/40">
                              <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary" colSpan={2}>Total</td>
                              <td className="px-4 py-2.5 font-mono font-bold text-text-primary text-xs">{fmt(totals.totalTrees)}</td>
                              <td className="px-4 py-2.5" />
                              <td className="px-4 py-2.5 font-mono font-bold text-text-primary text-xs">{fmtC(totals.totalEarnings)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Daily earnings log */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                      <div className="text-xs font-semibold text-text-primary">Daily Earnings Log</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-surface-secondary/50">
                            {["Date", "Block", "Trees", "Piece Rate", "Vac Pay", "Total"].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {entries.map(e => (
                            <tr key={e.id} className="hover:bg-surface-secondary/30 transition-colors">
                              <td className="px-4 py-3 font-mono text-text-primary whitespace-nowrap">{e.date}</td>
                              <td className="px-4 py-3 text-text-secondary">{e.block ?? <span className="opacity-30">—</span>}</td>
                              <td className="px-4 py-3 font-mono text-text-primary">{fmt(e.total_trees ?? 0)}</td>
                              <td className="px-4 py-3 font-mono text-text-secondary">{fmtC(Number(e.total_earnings ?? 0))}</td>
                              <td className="px-4 py-3 font-mono text-text-secondary">{fmtC(Number(e.vac_pay ?? 0))}</td>
                              <td className="px-4 py-3 font-mono font-semibold text-text-primary">{fmtC(Number(e.total_with_vac ?? 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-surface-secondary/40">
                            <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary" colSpan={2}>Total</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-text-primary text-xs">{fmt(totals.totalTrees)}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-text-primary text-xs">{fmtC(totals.totalEarnings)}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-text-primary text-xs">{fmtC(totals.totalVac)}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-xs" style={{ color: "var(--color-primary)" }}>{fmtC(totals.totalWithVac)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
