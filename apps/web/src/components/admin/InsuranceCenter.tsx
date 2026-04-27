"use client";

import { useState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtC(n: number) {
  return "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function statusPill(expiry: string) {
  const d = daysUntil(expiry);
  if (d <= 0) return { label: "Expired", style: { background: "rgba(239,68,68,0.15)", color: "var(--color-danger)" } };
  if (d <= 30) return { label: `Expires in ${d}d`, style: { background: "rgba(234,179,8,0.15)", color: "var(--color-warning)" } };
  return { label: `Active · ${d}d`, style: { background: "rgba(34,197,94,0.15)", color: "var(--color-primary)" } };
}

// ── Auto Policy ───────────────────────────────────────────────────────────────

const AUTO = {
  binder: "BINDER30655",
  insurer: "Gore Mutual Insurance",
  insured: "Integrity Reforestation Inc.",
  address: "860 Dunlop Crescent, Deux Rivieres, ON  K0J 1R0",
  effective: "2024-11-09",
  expiry:    "2025-11-09",
  annualPremium: 2446,
  totalCost: 2470.46,
  instalments: 11,
  instalmentAmt: 224.59,
  broker: "Kennedy Insurance Brokers Inc.",
  brokerAddress: "160 King Street West, North Bay, ON  P1B 5Z7",
  brokerPhone: "705-472-5950",
  brokerContact: "Erinn Hansman",
  brokerEmail: "erinn@kennedyinsurance.ca",
  driver: "Matthew McKernan",
  licence: "M1627-52928-81118",
  dob: "Nov 18, 1988",
  licenceClass: "G / AC (Air Brake)",
  convictions: "1 — Nov 22, 2021: Fail to yield (private road to highway)",
  vehicle: "2024 Chevrolet Silverado 2500HD LTZ Crew Cab 4WD",
  vin: "1GC4YPEY5RF314156",
  purchasePrice: "$125,098",
  fuel: "Diesel",
  annualKm: "15,000 km estimated",
  businessUse: "60% business / 40% personal",
  primaryUse: "Artisan – Tree Planting (carrying equipment & tools)",
  radius: "Normal 75 km (Deep River / Mattawa) · Max 120 km (North Bay / Petawawa)",
  lienholder: "RBC — 180 Wellington St West, 4th Floor, Toronto, ON  M5J 1J1",
};

const AUTO_COVERAGES = [
  { name: "Bodily Injury",                    limit: "$2,000,000",   deductible: null,     premium: 533,  note: "Covers injury or death to other persons in an accident you cause." },
  { name: "Property Damage",                  limit: "$2,000,000",   deductible: null,     premium: 30,   note: "Covers damage to another person's property when you are at fault." },
  { name: "Direct Compensation – Prop. Dmg.", limit: "As stated",    deductible: "$0",     premium: 394,  note: "Covers damage to your vehicle when another driver is at fault (Ontario DCPD)." },
  { name: "Accident Benefits",                limit: "Standard+",    deductible: null,     premium: 213,  note: "Pays your medical, rehab, and income replacement costs regardless of fault." },
  { name: "Uninsured Automobile",             limit: "As stated",    deductible: null,     premium: 30,   note: "Covers injury caused by an uninsured or hit-and-run driver." },
  { name: "All Perils",                       limit: "ACV",          deductible: "$1,000", premium: 928,  note: "Covers fire, theft, collision, comprehensive and all other physical damage to your vehicle." },
];

const ENDORSEMENTS = [
  { code: "OPCF 20",  name: "Loss of Use",                      limit: "$1,500 max",   premium: 57,  note: "Pays for a rental vehicle while yours is being repaired after a covered loss." },
  { code: "OPCF 23A", name: "Mortgage",                         limit: "RBC",          premium: 0,   note: "RBC noted as lienholder on the vehicle — insurance proceeds flow to lender on a write-off." },
  { code: "OPCF 27",  name: "Legal Liability – Non-Owned Veh.", limit: "$100,000",     premium: 110, note: "Covers damage you cause to a non-owned vehicle or trailer while using it." },
  { code: "OPCF 43",  name: "Removing Depreciation Deduction",  limit: "N/A",          premium: 65,  note: "On a total loss or major repair, insurer cannot deduct depreciation — you get replacement value." },
  { code: "OPCF 44",  name: "Family Protection",                limit: "$2,000,000",   premium: 49,  note: "Tops up your coverage if an at-fault driver carries less liability than your own limit." },
];

const ACCIDENT_BENEFITS = [
  { benefit: "Income Replacement",                   option: "$600 / week" },
  { benefit: "Medical, Rehab & Attendant Care",       option: "$130,000 (non-cat.)" },
  { benefit: "Caregiver, Housekeeping & Home Maint.", option: "Standard (cat. only)" },
  { benefit: "Dependent Care",                        option: "No coverage (standard)" },
  { benefit: "Death & Funeral",                       option: "$25K spouse / $10K dep." },
  { benefit: "Indexation Benefit",                    option: "No coverage (standard)" },
  { benefit: "OPCF 48 – Tort Deductible Offset",      option: "Standard deductibles" },
];

// ── Commercial General Liability ──────────────────────────────────────────────

const CGL = {
  policyNumber:   "SCHEL50045",
  insurer:        "Certain Underwriters at Trisura Guarantee Insurance Company, reinsured by Sompo",
  underwriter:    "Chutter Underwriting Services Casualty",
  effective:      "2025-04-15",
  expiry:         "2026-04-15",
  invoiceNumber:  "86812",
  invoiceDate:    "April 11, 2025",
  premium:        9306,
  insurerFee:     150,
  pst:            756.48,
  totalPremium:   10212.48,
  insured:        "Integrity Reforestation Inc.",
  address:        "860 Dunlop Crescent, Deux Rivieres, ON K0J 1R0",
  operations:     "Reforestation / Tree Planting",
  annualRevenue:  "$2,000,000",
  broker:         "Kennedy Insurance Brokers Inc.",
  brokerAddress:  "160 King Street West, North Bay, ON P1B 5Z7",
  brokerPhone:    "(705) 472-5950",
  brokerFax:      "(888) 681-2819",
  brokerEmail:    "certificates@yourcommunitybrokers.ca",
  brokerContact:  "Donna McTiernan",
  brokerVP:       "Erinn Hansman",
  brokerVPPhone:  "(705) 472-5991",
  brokerVPEmail:  "erinn@kennedyinsurance.ca",
  brokerClientId: "INTR16",
};

const CGL_COVERAGES = [
  { name: "Each Occurrence",                      limit: "$5,000,000", ded: "$2,500", note: "Bodily injury and property damage per single occurrence." },
  { name: "General Aggregate",                    limit: "$5,000,000", ded: "—",      note: "Maximum total payout for all CGL claims during the policy period." },
  { name: "Products & Completed Operations",      limit: "$5,000,000", ded: "—",      note: "Claims arising from work after it has been completed." },
  { name: "Medical Payments",                     limit: "$10,000",    ded: "—",      note: "Medical costs for injuries on insured premises, regardless of fault." },
  { name: "Tenants Legal Liability",              limit: "$250,000",   ded: "$1,000", note: "Accidental damage to premises rented by the insured." },
  { name: "Advertising Liability",                limit: "$5,000,000", ded: "$1,000", note: "Personal injury and advertising injury claims." },
  { name: "Non-Owned Automobiles",                limit: "$5,000,000", ded: "—",      note: "Liability for non-owned vehicles used in the course of business." },
  { name: "Hired Automobiles",                    limit: "$75,000",    ded: "$1,000", note: "Liability for rented or hired vehicles." },
];

const CGL_EXTENSIONS = [
  "Products and/or Completed Operations",
  "Cross Liability",
  "Tenants Legal Liability",
  "Contractual Liability",
  "Advertising Liability",
  "Non-Owned Automobiles",
  "Hired Automobiles",
];

// ── Commercial Property ───────────────────────────────────────────────────────

const PROPERTY = {
  policyNumber:  "CHTP12328",
  insurer:       "Chutter Underwriting Services Property",
  effective:     "2025-04-15",
  expiry:        "2026-04-15",
  invoiceNumber: "86811",
  invoiceDate:   "April 11, 2025",
  premium:       727,
  insurerFee:    50,
  pst:           62.16,
  totalPremium:  839.16,
  coInsurance:   "100%",
  description:   "Tree Planting Camp — Miscellaneous Property Floater",
};

const PROPERTY_ITEMS = [
  { item: "Range, Burners and Griddle",   value: 7513 },
  { item: "Hood Vent",                    value: 4500 },
  { item: "Refrigerators × 3",           value: 8475 },
  { item: "Remote Camp Infrastructure",  value: 10000 },
  { item: "Showers",                     value: 10000 },
  { item: "Mess Tents",                  value: 8000 },
];

// ── Certificates of Insurance ────────────────────────────────────────────────

const COIS = [
  {
    holder:             "Nawiinginokiima Forest Management Corporation",
    holderAddress:      "14 Hemlo Drive, P.O. Box 1479, Marathon, ON P0T 2E0",
    effective:          "2025-04-15",
    expiry:             "2026-04-15",
    issued:             "2025-05-02",
    forestFireExt:      false,
    additionalInsured:  "Nawiinginokiima Forest Management Corporation — His Majesty the King in right of Ontario, His Ministers, directors, officers, appointees, employees & agents",
  },
  {
    holder:             "Agoke Development LP (ADLP)",
    holderAddress:      "200-1120 Premier Way, Thunder Bay, ON P7B 0A3",
    effective:          "2025-04-15",
    expiry:             "2026-04-15",
    issued:             "2025-05-02",
    forestFireExt:      true,
    forestFireLimit:    "$1,000,000 each / $1,000,000 aggregate",
    additionalInsured:  "Agoke Development LP (ADLP) — 200-1120 Premier Way, Thunder Bay, ON P7B 0A3",
  },
  {
    holder:             "Hornepayne Lumber LP",
    holderAddress:      "Box 400, Hornepayne, ON P0M 1Z0",
    effective:          "2025-04-15",
    expiry:             "2026-04-15",
    issued:             "2025-05-02",
    forestFireExt:      true,
    forestFireLimit:    "$1,000,000 each / $1,000,000 aggregate",
    additionalInsured:  "Hornepayne Lumber LP — Box 400, Hornepayne, ON P0M 1Z0",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

type PolicyTab = "auto" | "cgl" | "property" | "coi";

const labelCls = "text-[10px] uppercase tracking-widest text-text-tertiary font-semibold mb-1";
const cardCls  = "bg-surface border border-border rounded-xl";

export default function InsuranceCenter() {
  const [activePolicy, setActivePolicy] = useState<PolicyTab>("cgl");

  const cglPill  = statusPill(CGL.expiry);
  const propPill = statusPill(PROPERTY.expiry);
  const autoPill = statusPill(AUTO.expiry);

  const tabs = [
    { id: "cgl"      as const, label: "Commercial General Liability", sub: `${CGL.policyNumber} · Chutter`,       pill: cglPill  },
    { id: "property" as const, label: "Commercial Property",          sub: `${PROPERTY.policyNumber} · Chutter`,  pill: propPill },
    { id: "coi"      as const, label: "Certificates of Insurance",    sub: "3 active COIs",                       pill: { label: "3 Issued", style: { background: "rgba(79,110,247,0.12)", color: "#4f6ef7" } } },
    { id: "auto"     as const, label: "Commercial Auto",              sub: `${AUTO.binder} · Gore Mutual`,        pill: autoPill },
  ];

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">Insurance</h1>
        <p className="text-sm text-text-tertiary mt-0.5">
          Integrity Reforestation Inc. · Kennedy Insurance Brokers Inc. · Client ID: INTR16
        </p>
      </div>

      {/* Policy Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tabs.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePolicy(p.id)}
            className="rounded-xl p-4 border text-left transition-all"
            style={{
              background:   activePolicy === p.id ? "var(--color-surface)" : "var(--color-surface-secondary)",
              borderColor:  activePolicy === p.id ? "var(--color-primary)" : "var(--color-border)",
            }}
          >
            <div className="flex items-start justify-between gap-1 mb-1">
              <span className="text-xs font-semibold text-text-primary leading-snug">{p.label}</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1.5" style={p.pill.style}>
              {p.pill.label}
            </span>
            <div className="text-[11px] text-text-tertiary">{p.sub}</div>
          </button>
        ))}
      </div>

      {/* ══════════ CGL ══════════ */}
      {activePolicy === "cgl" && (
        <div className="space-y-5">

          {/* Summary */}
          <div className={`${cardCls} p-5 grid grid-cols-2 md:grid-cols-4 gap-5`}>
            <div>
              <div className={labelCls}>Policy Number</div>
              <div className="text-sm font-bold text-text-primary font-mono">{CGL.policyNumber}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{CGL.underwriter}</div>
            </div>
            <div>
              <div className={labelCls}>Policy Period</div>
              <div className="text-sm font-semibold text-text-primary">Apr 15, 2025</div>
              <div className="text-xs text-text-tertiary mt-0.5">to Apr 15, 2026</div>
            </div>
            <div>
              <div className={labelCls}>Total Premium</div>
              <div className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>{fmtC(CGL.totalPremium)}</div>
              <div className="text-xs text-text-tertiary mt-0.5">incl. fee + PST · Invoice #{CGL.invoiceNumber}</div>
            </div>
            <div>
              <div className={labelCls}>Insured</div>
              <div className="text-sm font-semibold text-text-primary">{CGL.insured}</div>
              <div className="text-xs text-text-tertiary mt-0.5 leading-snug">{CGL.operations} · Revenue {CGL.annualRevenue}</div>
            </div>
          </div>

          {/* Coverage table */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Coverage Limits</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Coverage", "Limit", "Deductible"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {CGL_COVERAGES.map(c => (
                  <tr key={c.name} className="hover:bg-surface-secondary/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{c.name}</div>
                      <div className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed">{c.note}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: "var(--color-primary)" }}>{c.limit}</td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{c.ded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Extensions + Premium side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Extensions */}
            <div className={`${cardCls} p-5`}>
              <div className={`${labelCls} mb-3`}>Active Extensions & Endorsements</div>
              <div className="space-y-1.5">
                {CGL_EXTENSIONS.map(ext => (
                  <div key={ext} className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--color-primary)" }} />
                    {ext}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg border border-border bg-surface-secondary">
                <div className="text-[10px] font-semibold text-text-tertiary mb-1">Forest Fire Fighting Extension</div>
                <div className="text-xs text-text-secondary">$1,000,000 per occurrence / aggregate · Ded. $5,000 · Included on Agoke & Hornepayne COIs only</div>
              </div>
            </div>

            {/* Premium breakdown */}
            <div className={`${cardCls} p-5`}>
              <div className={`${labelCls} mb-3`}>Premium Breakdown</div>
              <div className="space-y-2">
                {[
                  ["Base Premium",  fmtC(CGL.premium)],
                  ["Insurer Fee",   fmtC(CGL.insurerFee)],
                  ["PST (8%)",      fmtC(CGL.pst)],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-text-tertiary">{label}</span>
                    <span className="text-text-secondary font-medium">{val}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                  <span className="text-text-primary">Total Due</span>
                  <span style={{ color: "var(--color-primary)" }}>{fmtC(CGL.totalPremium)}</span>
                </div>
              </div>
              <div className="mt-4 space-y-1 text-xs text-text-tertiary">
                <div>Invoice #{CGL.invoiceNumber} · Dated {CGL.invoiceDate}</div>
                <div>Due April 15, 2025</div>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className={`${cardCls} p-5`}>
            <div className={`${labelCls} mb-3`}>Contacts</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg p-3 border border-border bg-surface-secondary">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Broker</div>
                <div className="text-sm font-bold text-text-primary">{CGL.broker}</div>
                <div className="text-xs text-text-tertiary mt-1">{CGL.brokerAddress}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{CGL.brokerPhone}</div>
                <div className="text-xs text-text-tertiary">{CGL.brokerEmail}</div>
              </div>
              <div className="rounded-lg p-3 border border-border bg-surface-secondary">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Authorized Rep</div>
                <div className="text-sm font-bold text-text-primary">{CGL.brokerContact}</div>
                <div className="text-xs text-text-tertiary mt-1">Signed COIs · Certificates</div>
                <div className="text-xs text-text-tertiary mt-0.5">{CGL.brokerEmail}</div>
              </div>
              <div className="rounded-lg p-3 border border-border bg-surface-secondary">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">VP Commercial Insurance</div>
                <div className="text-sm font-bold text-text-primary">{CGL.brokerVP}</div>
                <div className="text-xs text-text-tertiary mt-1">{CGL.brokerVPPhone}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{CGL.brokerVPEmail}</div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══════════ PROPERTY ══════════ */}
      {activePolicy === "property" && (
        <div className="space-y-5">

          {/* Summary */}
          <div className={`${cardCls} p-5 grid grid-cols-2 md:grid-cols-4 gap-5`}>
            <div>
              <div className={labelCls}>Policy Number</div>
              <div className="text-sm font-bold text-text-primary font-mono">{PROPERTY.policyNumber}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{PROPERTY.insurer}</div>
            </div>
            <div>
              <div className={labelCls}>Policy Period</div>
              <div className="text-sm font-semibold text-text-primary">Apr 15, 2025</div>
              <div className="text-xs text-text-tertiary mt-0.5">to Apr 15, 2026</div>
            </div>
            <div>
              <div className={labelCls}>Total Premium</div>
              <div className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>{fmtC(PROPERTY.totalPremium)}</div>
              <div className="text-xs text-text-tertiary mt-0.5">incl. fee + PST · Invoice #{PROPERTY.invoiceNumber}</div>
            </div>
            <div>
              <div className={labelCls}>Co-insurance</div>
              <div className="text-sm font-semibold text-text-primary">{PROPERTY.coInsurance}</div>
              <div className="text-xs text-text-tertiary mt-0.5">Insure to 100% actual cash value</div>
            </div>
          </div>

          {/* Property items */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="text-xs font-semibold text-text-primary">Miscellaneous Property Floater — Insured Items</div>
              <div className="text-xs text-text-tertiary">{PROPERTY.description}</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">Item</th>
                  <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">Insured Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {PROPERTY_ITEMS.map(p => (
                  <tr key={p.item} className="hover:bg-surface-secondary/40">
                    <td className="px-4 py-3 text-text-primary font-medium">{p.item}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--color-primary)" }}>{fmtC(p.value)}</td>
                  </tr>
                ))}
                <tr className="bg-surface-secondary/50 border-t border-border">
                  <td className="px-4 py-2.5 text-xs font-bold text-text-primary">Total Insured Value</td>
                  <td className="px-4 py-2.5 text-right text-xs font-black" style={{ color: "var(--color-primary)" }}>
                    {fmtC(PROPERTY_ITEMS.reduce((s, p) => s + p.value, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Premium breakdown + Co-insurance note */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${cardCls} p-5`}>
              <div className={`${labelCls} mb-3`}>Premium Breakdown</div>
              <div className="space-y-2">
                {[
                  ["Base Premium",  fmtC(PROPERTY.premium)],
                  ["Insurer Fee",   fmtC(PROPERTY.insurerFee)],
                  ["PST (8%)",      fmtC(PROPERTY.pst)],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-text-tertiary">{label}</span>
                    <span className="text-text-secondary font-medium">{val}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                  <span className="text-text-primary">Total Due</span>
                  <span style={{ color: "var(--color-primary)" }}>{fmtC(PROPERTY.totalPremium)}</span>
                </div>
              </div>
              <div className="mt-4 text-xs text-text-tertiary">
                Invoice #{PROPERTY.invoiceNumber} · Dated {PROPERTY.invoiceDate}
              </div>
            </div>

            <div className={`${cardCls} p-5`}>
              <div className={`${labelCls} mb-3`}>Co-insurance Notes</div>
              <ul className="space-y-2 text-xs text-text-secondary leading-relaxed">
                <li className="flex gap-2">
                  <span style={{ color: "var(--color-warning)" }} className="shrink-0">▲</span>
                  <span>Co-insurance is set at <strong className="text-text-primary">100%</strong>. You must insure to the full actual cash value or replacement cost to avoid a penalty on a partial loss.</span>
                </li>
                <li className="flex gap-2">
                  <span style={{ color: "var(--color-warning)" }} className="shrink-0">▲</span>
                  <span>Policy will not pay more than the limit specified. If an item's value has increased, notify Kennedy Insurance to update the schedule.</span>
                </li>
                <li className="flex gap-2">
                  <span style={{ color: "var(--color-primary)" }} className="shrink-0">✓</span>
                  <span>New items added for 2025: Remote Camp Infrastructure ($10,000), Showers ($10,000), Mess Tents ($8,000).</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* ══════════ COIs ══════════ */}
      {activePolicy === "coi" && (
        <div className="space-y-5">

          {/* Info banner */}
          <div className="rounded-xl p-4 border text-xs text-text-secondary leading-relaxed"
            style={{ background: "rgba(79,110,247,0.06)", borderColor: "rgba(79,110,247,0.2)" }}>
            <strong className="text-text-primary">Policy SCHEL50045</strong> — Certificates issued May 2, 2025 by Donna McTiernan (Kennedy Insurance Brokers Inc.).
            All COIs are valid April 15, 2025 – April 15, 2026. 30-day written notice of cancellation to each certificate holder.
          </div>

          {/* COI cards */}
          {COIS.map((coi, i) => (
            <div key={i} className={`${cardCls} overflow-hidden`}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-text-primary">{coi.holder}</div>
                  <div className="text-xs text-text-tertiary mt-0.5">{coi.holderAddress}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={statusPill(coi.expiry).style}>
                    {statusPill(coi.expiry).label}
                  </span>
                  {coi.forestFireExt && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "var(--color-danger)" }}>
                      Forest Fire Ext
                    </span>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-b border-border">
                <div>
                  <div className={labelCls}>Effective</div>
                  <div className="text-text-primary font-medium">Apr 15, 2025</div>
                </div>
                <div>
                  <div className={labelCls}>Expiry</div>
                  <div className="text-text-primary font-medium">Apr 15, 2026</div>
                </div>
                <div>
                  <div className={labelCls}>Issued</div>
                  <div className="text-text-primary font-medium">May 2, 2025</div>
                </div>
                <div>
                  <div className={labelCls}>Policy</div>
                  <div className="text-text-primary font-mono font-medium">SCHEL50045</div>
                </div>
              </div>

              {/* Coverages on this COI */}
              <div className="px-5 py-4 border-b border-border">
                <div className={`${labelCls} mb-2`}>Coverages on This Certificate</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                  {[
                    ["CGL Each Occurrence", "$5,000,000 · Ded. $2,500"],
                    ["General Aggregate", "$5,000,000"],
                    ["Products & Completed Ops", "$5,000,000"],
                    ["Medical Payments", "$10,000"],
                    ["Tenants Legal Liability", "$250,000 · Ded. $1,000"],
                    ["Advertising Liability", "$5,000,000 · Ded. $1,000"],
                    ["Non-Owned Automobiles", "$5,000,000"],
                    ["Hired Automobiles", "$75,000 · Ded. $1,000"],
                    ...(coi.forestFireExt ? [["Forest Fire Fighting Ext", coi.forestFireLimit + " · Ded. $5,000"]] : []),
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-baseline gap-2 text-xs py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: "var(--color-primary)" }} />
                      <span className="text-text-secondary w-44 shrink-0">{label}</span>
                      <span className="text-text-primary font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional insured */}
              <div className="px-5 py-3 bg-surface-secondary/40">
                <div className={`${labelCls} mb-1`}>Additional Insured</div>
                <div className="text-xs text-text-secondary leading-relaxed">{coi.additionalInsured}</div>
              </div>
            </div>
          ))}

        </div>
      )}

      {/* ══════════ AUTO ══════════ */}
      {activePolicy === "auto" && (
        <div className="space-y-5">

          {/* Summary card */}
          <div className={`${cardCls} p-5 grid grid-cols-2 md:grid-cols-4 gap-5`}>
            <div>
              <div className={labelCls}>Insured</div>
              <div className="text-sm font-semibold text-text-primary">{AUTO.insured}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{AUTO.address}</div>
            </div>
            <div>
              <div className={labelCls}>Policy Period</div>
              <div className="text-sm font-semibold text-text-primary">Nov 9, 2024</div>
              <div className="text-xs text-text-tertiary mt-0.5">to Nov 9, 2025</div>
            </div>
            <div>
              <div className={labelCls}>Annual Premium</div>
              <div className="text-sm font-semibold text-text-primary">{fmtC(AUTO.annualPremium)}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{AUTO.instalments} payments of {fmtC(AUTO.instalmentAmt)}</div>
            </div>
            <div>
              <div className={labelCls}>Insurer / Binder</div>
              <div className="text-sm font-semibold text-text-primary">{AUTO.insurer}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{AUTO.binder}</div>
            </div>
          </div>

          {/* Vehicle + Driver */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${cardCls} p-5`}>
              <div className={`${labelCls} mb-3`}>Insured Vehicle</div>
              <div className="text-sm font-bold text-text-primary mb-3">{AUTO.vehicle}</div>
              <div className="space-y-1.5 text-xs">
                {[["VIN", AUTO.vin], ["Purchase", AUTO.purchasePrice], ["Fuel", AUTO.fuel], ["Annual KM", AUTO.annualKm], ["Use Split", AUTO.businessUse], ["Primary Use", AUTO.primaryUse], ["Radius", AUTO.radius], ["Lienholder", AUTO.lienholder]].map(([l, v]) => (
                  <div key={l} className="flex gap-2">
                    <span className="text-text-tertiary w-24 shrink-0">{l}</span>
                    <span className="text-text-secondary">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`${cardCls} p-5`}>
              <div className={`${labelCls} mb-3`}>Principal Driver</div>
              <div className="text-sm font-bold text-text-primary mb-3">{AUTO.driver}</div>
              <div className="space-y-1.5 text-xs">
                {[["Licence #", AUTO.licence], ["DOB", AUTO.dob], ["Class", AUTO.licenceClass]].map(([l, v]) => (
                  <div key={l} className="flex gap-2">
                    <span className="text-text-tertiary w-24 shrink-0">{l}</span>
                    <span className="text-text-secondary">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg px-3 py-2 border" style={{ background: "rgba(234,179,8,0.07)", borderColor: "rgba(234,179,8,0.25)" }}>
                <div className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--color-warning)" }}>Conviction on Record</div>
                <div className="text-xs text-text-secondary">{AUTO.convictions}</div>
              </div>
            </div>
          </div>

          {/* Coverage table */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Coverage</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Coverage", "Limit", "Deductible", "Annual Premium"].map(h => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary ${h === "Annual Premium" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {AUTO_COVERAGES.map(c => (
                  <tr key={c.name} className="hover:bg-surface-secondary/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{c.name}</div>
                      <div className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed max-w-sm">{c.note}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-primary)" }}>{c.limit}</td>
                    <td className="px-4 py-3 text-text-secondary">{c.deductible ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-text-primary">{fmtC(c.premium)}</td>
                  </tr>
                ))}
                <tr className="bg-surface-secondary/50 border-t border-border">
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-text-secondary">Core Coverage Subtotal</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-text-primary">{fmtC(AUTO_COVERAGES.reduce((s, c) => s + c.premium, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Endorsements */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Endorsements (OPCFs)</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Code", "Endorsement", "Limit", "Premium"].map(h => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary ${h === "Premium" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {ENDORSEMENTS.map(e => (
                  <tr key={e.code} className="hover:bg-surface-secondary/40">
                    <td className="px-4 py-3 font-mono text-text-tertiary whitespace-nowrap">{e.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{e.name}</div>
                      <div className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed max-w-sm">{e.note}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{e.limit}</td>
                    <td className="px-4 py-3 text-right font-semibold text-text-primary">{e.premium > 0 ? fmtC(e.premium) : "Incl."}</td>
                  </tr>
                ))}
                <tr className="bg-surface-secondary/50 border-t border-border">
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-text-secondary">Endorsement Subtotal</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-text-primary">{fmtC(ENDORSEMENTS.reduce((s, e) => s + e.premium, 0))}</td>
                </tr>
                <tr style={{ background: "rgba(34,197,94,0.05)", borderTop: "1px solid var(--color-border)" }}>
                  <td colSpan={3} className="px-4 py-3 text-sm font-bold text-text-primary">Total Annual Premium</td>
                  <td className="px-4 py-3 text-right text-sm font-black" style={{ color: "var(--color-primary)" }}>{fmtC(AUTO.annualPremium)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Accident Benefits */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Accident Benefits — Selected Options</div>
            </div>
            <div className="divide-y divide-border/40">
              {ACCIDENT_BENEFITS.map(ab => (
                <div key={ab.benefit} className="flex items-center justify-between px-5 py-3 gap-4 hover:bg-surface-secondary/30">
                  <span className="text-xs text-text-primary">{ab.benefit}</span>
                  <span className="text-xs text-text-secondary text-right">{ab.option}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Limitations */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-danger)" }} />
              <div className="text-xs font-semibold text-text-primary">Key Limitations &amp; What&apos;s Not Covered</div>
            </div>
            <ul className="space-y-2 text-xs text-text-secondary leading-relaxed">
              <li className="flex gap-2"><span style={{ color: "var(--color-danger)" }} className="shrink-0 mt-px">▲</span><span><strong className="text-text-primary">No USA coverage</strong> — policy is Canada only.</span></li>
              <li className="flex gap-2"><span style={{ color: "var(--color-danger)" }} className="shrink-0 mt-px">▲</span><span><strong className="text-text-primary">No hauling for others</strong> — tree planting equipment only.</span></li>
              <li className="flex gap-2"><span style={{ color: "var(--color-danger)" }} className="shrink-0 mt-px">▲</span><span><strong className="text-text-primary">Radius of operation</strong> — declared 75 km normal / 120 km maximum.</span></li>
              <li className="flex gap-2"><span style={{ color: "var(--color-danger)" }} className="shrink-0 mt-px">▲</span><span><strong className="text-text-primary">Business use %</strong> — declared 60% business. Material increases must be reported.</span></li>
              <li className="flex gap-2"><span style={{ color: "var(--color-danger)" }} className="shrink-0 mt-px">▲</span><span><strong className="text-text-primary">Conviction on record</strong> — Nov 2021 conviction affects rating. New convictions must be reported.</span></li>
              <li className="flex gap-2"><span style={{ color: "var(--color-danger)" }} className="shrink-0 mt-px">▲</span><span><strong className="text-text-primary">Other drivers</strong> — only Matthew McKernan listed. Any regular additional drivers must be declared.</span></li>
            </ul>
          </div>

          {/* Contacts */}
          <div className={`${cardCls} p-5`}>
            <div className={`${labelCls} mb-3`}>Contacts</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg p-3 border border-border bg-surface-secondary">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Broker</div>
                <div className="text-sm font-bold text-text-primary">{AUTO.broker}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{AUTO.brokerAddress}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{AUTO.brokerPhone}</div>
              </div>
              <div className="rounded-lg p-3 border border-border bg-surface-secondary">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Broker Contact</div>
                <div className="text-sm font-bold text-text-primary">{AUTO.brokerContact}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{AUTO.brokerEmail}</div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
