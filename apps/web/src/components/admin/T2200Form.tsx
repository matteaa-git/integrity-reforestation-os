"use client";

import { useState, useRef } from "react";
import type { Employee } from "@/app/admin/page";
import { saveDocument, saveDocumentBlob } from "@/lib/adminDb";

interface Props {
  employees: Employee[];
  onClose: () => void;
}

type YN = "yes" | "no" | "";

interface FormState {
  // Part A – Employee
  lastName:    string;
  firstName:   string;
  taxYear:     string;
  jobTitle:    string;
  duties:      string;
  // Part B – Employer
  employerName:    string;
  employerAddress: string;
  // Part C – 14 questions
  q1:  YN; q1_details: string;
  q2:  YN; q2_amount:  string;
  q3:  YN;
  q4:  YN; q4_amount:  string;
  q5:  YN;
  q6:  YN;
  q7:  YN; q7_amount:  string;
  q8:  YN; q8_amount:  string;
  q9:  YN;
  q9a: YN; q9b: string;
  q10: YN; q10_amount: string;
  q11: YN;
  q12: YN;
  q13: YN;
  q14: YN;
  // Part D – Employer certification
  authName:  string;
  authTitle: string;
  authDate:  string;
  authPhone: string;
  // Part E – Employee
  empSIN:     string;
  empAddress: string;
  empDate:    string;
}

const EMPTY: FormState = {
  lastName: "", firstName: "", taxYear: String(new Date().getFullYear() - 1),
  jobTitle: "", duties: "",
  employerName: "Integrity Reforestation Inc.",
  employerAddress: "PO Box 1543, North Bay, ON  P1B 8K7",
  q1: "", q1_details: "",
  q2: "", q2_amount: "",
  q3: "",
  q4: "", q4_amount: "",
  q5: "",
  q6: "",
  q7: "", q7_amount: "",
  q8: "", q8_amount: "",
  q9: "",
  q9a: "", q9b: "",
  q10: "", q10_amount: "",
  q11: "",
  q12: "",
  q13: "",
  q14: "",
  authName: "Matthew McKernan", authTitle: "Chief Executive Officer",
  authDate: new Date().toISOString().split("T")[0],
  authPhone: "",
  empSIN: "", empAddress: "", empDate: "",
};

const inp = "w-full text-xs bg-white border border-gray-300 rounded px-2.5 py-1.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-600";
const lbl = "block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1";

function YesNo({ value, onChange }: { value: YN; onChange: (v: YN) => void }) {
  return (
    <div className="flex gap-4">
      {(["yes", "no"] as const).map(v => (
        <label key={v} className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name={`yn-${Math.random()}`}
            checked={value === v}
            onChange={() => onChange(v)}
            className="accent-green-600"
          />
          <span className="text-xs font-medium text-gray-700 capitalize">{v}</span>
        </label>
      ))}
    </div>
  );
}

function Section({ title, code, children }: { title: string; code: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{code}</div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-700">{title}</div>
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

function QRow({ num, question, children }: { num: number; question: string; children?: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
      <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
        <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">{num}</span>
        <div className="flex-1">
          <p className="text-xs text-gray-700 leading-relaxed">{question}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function T2200Form({ employees, onClose }: Props) {
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function pickEmployee(name: string) {
    const emp = employees.find(e => e.name === name);
    if (!emp) return;
    const parts = name.trim().split(" ");
    const last  = parts.slice(-1)[0] ?? "";
    const first = parts.slice(0, -1).join(" ");
    const addr = [emp.streetAddress, emp.city, emp.province].filter(Boolean).join(", ");
    setForm(f => ({
      ...f,
      lastName:   last,
      firstName:  first,
      jobTitle:   emp.role ?? "",
      empSIN:     emp.sin ?? "",
      empAddress: addr,
    }));
  }

  // ── Print PDF ──────────────────────────────────────────────────────────────
  function handlePrint() {
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win || !printRef.current) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>T2200 – ${form.firstName} ${form.lastName} – ${form.taxYear}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: white; padding: 24px; }
        h1 { font-size: 15px; font-weight: 800; color: #c0392b; margin-bottom: 2px; }
        h2 { font-size: 11px; font-weight: 700; color: #333; margin-bottom: 12px; }
        .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          color: #555; border-bottom: 1.5px solid #c0392b; margin: 16px 0 8px; padding-bottom: 4px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
        .field { margin-bottom: 6px; }
        .field label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #777; margin-bottom: 2px; }
        .field .val { border-bottom: 1px solid #888; min-height: 16px; padding: 1px 0; font-size: 11px; }
        .q-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px; border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; }
        .q-num { font-size: 9px; font-weight: 700; color: #aaa; min-width: 16px; }
        .q-text { font-size: 10.5px; flex: 1; line-height: 1.4; }
        .q-ans { font-size: 10px; font-weight: 700; color: ${""};  white-space: nowrap; }
        .yn-yes { color: #15803d; }
        .yn-no  { color: #b91c1c; }
        .yn-blank { color: #aaa; }
        .sub { margin-top: 4px; font-size: 10px; color: #444; }
        .sub label { font-size: 9px; color: #777; text-transform: uppercase; }
        .footer { margin-top: 20px; font-size: 9px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
        @media print { body { padding: 10px; } }
      </style>
    </head><body>
      <h1>T2200 — Declaration of Conditions of Employment</h1>
      <h2>Canada Revenue Agency · Tax Year ${form.taxYear}</h2>

      <div class="section-title">Part A — Employee Information</div>
      <div class="grid3">
        <div class="field"><label>Last Name</label><div class="val">${form.lastName}</div></div>
        <div class="field"><label>First Name</label><div class="val">${form.firstName}</div></div>
        <div class="field"><label>Tax Year</label><div class="val">${form.taxYear}</div></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Job Title</label><div class="val">${form.jobTitle}</div></div>
        <div class="field"><label>Brief Description of Duties</label><div class="val">${form.duties}</div></div>
      </div>

      <div class="section-title">Part B — Employer Information</div>
      <div class="grid2">
        <div class="field"><label>Employer Name</label><div class="val">${form.employerName}</div></div>
        <div class="field"><label>Employer Address</label><div class="val">${form.employerAddress}</div></div>
      </div>

      <div class="section-title">Part C — Conditions of Employment</div>
      ${(
        [
          [1, "Was this employee required to work away from your place of business, or in different places?", form.q1, form.q1 === "yes" ? `Details: ${form.q1_details}` : ""],
          [2, "Did this employee receive, or is this employee entitled to receive, a non-taxable motor vehicle or travel allowance?", form.q2, form.q2 === "yes" ? `Amount: $${form.q2_amount}` : ""],
          [3, "Did you require this employee to pay their own expenses while carrying out the duties of employment?", form.q3, ""],
          [4, "Did this employee receive or will this employee receive a repayable advance for travel expenses?", form.q4, form.q4 === "yes" ? `Amount: $${form.q4_amount}` : ""],
          [5, "Was this employee required to be away for at least 12 consecutive hours from the municipality or metropolitan area where your establishment is located?", form.q5, ""],
          [6, "Was this employee required to pay for a substitute or assistant?", form.q6, ""],
          [7, "Was this employee required to pay for supplies that they used directly in their work?", form.q7, form.q7 === "yes" ? `Amount: $${form.q7_amount}` : ""],
          [8, "Was this employee required to use part of their home for work?", form.q8, form.q8 === "yes" ? `Home expenses: $${form.q8_amount}` : ""],
          [9, "Was this employee required to rent an office away from your place of business and pay rent for that office?", form.q9, form.q9 === "yes" ? `(a) ${form.q9a}  (b) ${form.q9b}` : ""],
          [10, "Was this employee required to pay for the cost of any cellular phone, internet access, or a computer to allow the employee to work from home?", form.q10, form.q10 === "yes" ? `Amount: $${form.q10_amount}` : ""],
          [11, "Was this employee required to travel away from the municipal or metropolitan area?", form.q11, ""],
          [12, "Was this employee required to use their personal vehicle in the course of employment?", form.q12, ""],
          [13, "Did this employee receive or is this employee entitled to receive a non-accountable allowance or reimbursement?", form.q13, ""],
          [14, "Was this employee required to pay membership fees or professional dues as a condition of employment?", form.q14, ""],
        ] as [number, string, YN, string][]
      ).map(([n, q, ans, sub]) => `
        <div class="q-row">
          <div class="q-num">${n}</div>
          <div class="q-text">${q}${sub ? `<div class="sub">${sub}</div>` : ""}</div>
          <div class="q-ans ${ans === "yes" ? "yn-yes" : ans === "no" ? "yn-no" : "yn-blank"}">${ans === "yes" ? "YES" : ans === "no" ? "NO" : "—"}</div>
        </div>
      `).join("")}

      <div class="section-title">Part D — Employer Certification</div>
      <div class="grid2">
        <div class="field"><label>Authorized Person Name</label><div class="val">${form.authName}</div></div>
        <div class="field"><label>Title</label><div class="val">${form.authTitle}</div></div>
      </div>
      <div class="grid3">
        <div class="field"><label>Date Signed</label><div class="val">${form.authDate}</div></div>
        <div class="field"><label>Telephone</label><div class="val">${form.authPhone}</div></div>
        <div class="field"><label>Signature</label><div class="val" style="height:28px;"></div></div>
      </div>

      <div class="section-title">Part E — Employee Certification</div>
      <div class="grid3">
        <div class="field"><label>Employee Name</label><div class="val">${form.firstName} ${form.lastName}</div></div>
        <div class="field"><label>SIN</label><div class="val">${form.empSIN}</div></div>
        <div class="field"><label>Date</label><div class="val">${form.empDate}</div></div>
      </div>
      <div class="field"><label>Home Address</label><div class="val">${form.empAddress}</div></div>

      <div class="footer">
        T2200 E (23) — Protected B when completed · Canada Revenue Agency · ${form.employerName}
      </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  }

  // ── Save to Documents ──────────────────────────────────────────────────────
  async function handleSaveToDocuments() {
    setSaving(true);
    try {
      const htmlContent = `<!DOCTYPE html><html><head><title>T2200 ${form.taxYear}</title></head><body>
        <pre style="font-family:sans-serif;font-size:11px;white-space:pre-wrap">
T2200 – Declaration of Conditions of Employment
Tax Year: ${form.taxYear}

PART A – Employee
Last Name: ${form.lastName}
First Name: ${form.firstName}
Job Title: ${form.jobTitle}
Duties: ${form.duties}

PART B – Employer
Name: ${form.employerName}
Address: ${form.employerAddress}

PART C – Conditions of Employment
Q1  Away from place of business:      ${form.q1.toUpperCase() || "—"}  ${form.q1_details}
Q2  Non-taxable motor vehicle allow.:  ${form.q2.toUpperCase() || "—"}  $${form.q2_amount}
Q3  Required to pay own expenses:      ${form.q3.toUpperCase() || "—"}
Q4  Repayable travel advance:          ${form.q4.toUpperCase() || "—"}  $${form.q4_amount}
Q5  Away 12+ consecutive hours:        ${form.q5.toUpperCase() || "—"}
Q6  Pay for substitute/assistant:      ${form.q6.toUpperCase() || "—"}
Q7  Pay for work supplies:             ${form.q7.toUpperCase() || "—"}  $${form.q7_amount}
Q8  Use part of home for work:         ${form.q8.toUpperCase() || "—"}  $${form.q8_amount}
Q9  Rent office away from business:    ${form.q9.toUpperCase() || "—"}
Q10 Cell phone/internet/computer:      ${form.q10.toUpperCase() || "—"}  $${form.q10_amount}
Q11 Travel away from municipality:     ${form.q11.toUpperCase() || "—"}
Q12 Use personal vehicle:              ${form.q12.toUpperCase() || "—"}
Q13 Non-accountable allowance:         ${form.q13.toUpperCase() || "—"}
Q14 Membership fees / dues:            ${form.q14.toUpperCase() || "—"}

PART D – Employer Certification
Name: ${form.authName}  Title: ${form.authTitle}
Date: ${form.authDate}  Phone: ${form.authPhone}

PART E – Employee
Name: ${form.firstName} ${form.lastName}
SIN: ${form.empSIN}
Address: ${form.empAddress}
Date: ${form.empDate}
        </pre>
      </body></html>`;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const docId = `t2200-${Date.now()}`;
      const empName = `${form.firstName} ${form.lastName}`.trim();

      await saveDocument({
        id: docId,
        name: `T2200 – ${empName} – ${form.taxYear}`,
        category: "tax",
        employee: empName,
        dateAdded: new Date().toISOString().split("T")[0],
        status: "draft",
        size: `${(blob.size / 1024).toFixed(1)} KB`,
        hasFile: true,
      });
      await saveDocumentBlob(docId, blob);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="w-8 h-8 rounded-lg bg-red-700 flex items-center justify-center text-white text-[11px] font-bold shrink-0">T22</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-gray-900">T2200 — Declaration of Conditions of Employment</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Canada Revenue Agency · Fill all parts, then download or save</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-7" ref={printRef}>

          {/* Employee picker */}
          <div>
            <label className={lbl}>Auto-fill from employee</label>
            <select onChange={e => pickEmployee(e.target.value)} defaultValue=""
              className={inp}>
              <option value="" disabled>Select employee to auto-fill…</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>

          {/* ── Part A ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-white text-[10px] font-bold">A</span>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Part A — Employee Information</span>
            </div>
            <div className="pl-8 grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Last Name</label>
                <input className={inp} value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Smith" />
              </div>
              <div>
                <label className={lbl}>First Name</label>
                <input className={inp} value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="John" />
              </div>
              <div>
                <label className={lbl}>Tax Year</label>
                <input className={inp} type="number" value={form.taxYear} onChange={e => set("taxYear", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Job Title</label>
                <input className={inp} value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)} placeholder="Tree Planter" />
              </div>
              <div className="col-span-1">
                <label className={lbl}>Description of Duties</label>
                <input className={inp} value={form.duties} onChange={e => set("duties", e.target.value)} placeholder="Reforestation field work" />
              </div>
            </div>
          </div>

          {/* ── Part B ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-white text-[10px] font-bold">B</span>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Part B — Employer Information</span>
            </div>
            <div className="pl-8 grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Employer Name</label>
                <input className={inp} value={form.employerName} onChange={e => set("employerName", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Employer Address</label>
                <input className={inp} value={form.employerAddress} onChange={e => set("employerAddress", e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Part C ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-white text-[10px] font-bold">C</span>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Part C — Conditions of Employment</span>
            </div>
            <div className="pl-8 space-y-2">

              {/* Q1 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">1</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to work away from your place of business, or in different places?</p>
                    <YesNo value={form.q1} onChange={v => set("q1", v)} />
                    {form.q1 === "yes" && (
                      <div className="mt-2">
                        <label className={lbl}>Type of work / locations</label>
                        <input className={inp} value={form.q1_details} onChange={e => set("q1_details", e.target.value)} placeholder="e.g. Reforestation camps across Northern Ontario" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Q2 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">2</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Did this employee receive, or is this employee entitled to receive, a non-taxable motor vehicle or travel allowance?</p>
                    <YesNo value={form.q2} onChange={v => set("q2", v)} />
                    {form.q2 === "yes" && (
                      <div className="mt-2">
                        <label className={lbl}>Amount ($)</label>
                        <input className={inp} type="number" min="0" step="0.01" value={form.q2_amount} onChange={e => set("q2_amount", e.target.value)} placeholder="0.00" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Q3 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">3</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Did you require this employee to pay their own expenses while carrying out the duties of employment?</p>
                    <YesNo value={form.q3} onChange={v => set("q3", v)} />
                  </div>
                </div>
              </div>

              {/* Q4 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">4</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Did this employee receive or will this employee receive a repayable advance for travel expenses?</p>
                    <YesNo value={form.q4} onChange={v => set("q4", v)} />
                    {form.q4 === "yes" && (
                      <div className="mt-2">
                        <label className={lbl}>Amount of advance ($)</label>
                        <input className={inp} type="number" min="0" step="0.01" value={form.q4_amount} onChange={e => set("q4_amount", e.target.value)} placeholder="0.00" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Q5 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">5</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to be away for at least 12 consecutive hours from the municipality or metropolitan area where your establishment is located?</p>
                    <YesNo value={form.q5} onChange={v => set("q5", v)} />
                  </div>
                </div>
              </div>

              {/* Q6 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">6</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to pay for a substitute or assistant?</p>
                    <YesNo value={form.q6} onChange={v => set("q6", v)} />
                  </div>
                </div>
              </div>

              {/* Q7 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">7</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to pay for supplies that they used directly in their work?</p>
                    <YesNo value={form.q7} onChange={v => set("q7", v)} />
                    {form.q7 === "yes" && (
                      <div className="mt-2">
                        <label className={lbl}>Amount ($)</label>
                        <input className={inp} type="number" min="0" step="0.01" value={form.q7_amount} onChange={e => set("q7_amount", e.target.value)} placeholder="0.00" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Q8 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">8</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to use part of their home for work?</p>
                    <YesNo value={form.q8} onChange={v => set("q8", v)} />
                    {form.q8 === "yes" && (
                      <div className="mt-2 space-y-2">
                        <div>
                          <label className={lbl}>Home office / rent expenses ($)</label>
                          <input className={inp} type="number" min="0" step="0.01" value={form.q8_amount} onChange={e => set("q8_amount", e.target.value)} placeholder="0.00" />
                        </div>
                        <div>
                          <label className={lbl}>Sub-question 9a — Was the employee required to pay rent for the office space?</label>
                          <YesNo value={form.q9a} onChange={v => set("q9a", v)} />
                        </div>
                        <div>
                          <label className={lbl}>Sub-question 9b — Type(s) of expenses (rent, internet, utilities…)</label>
                          <input className={inp} value={form.q9b} onChange={e => set("q9b", e.target.value)} placeholder="e.g. Rent, utilities, internet" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Q9 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">9</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to rent an office away from your place of business and pay rent for that office?</p>
                    <YesNo value={form.q9} onChange={v => set("q9", v)} />
                  </div>
                </div>
              </div>

              {/* Q10 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">10</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to pay for the cost of a cellular phone, internet access, or computer to allow them to work from home?</p>
                    <YesNo value={form.q10} onChange={v => set("q10", v)} />
                    {form.q10 === "yes" && (
                      <div className="mt-2">
                        <label className={lbl}>Amount ($)</label>
                        <input className={inp} type="number" min="0" step="0.01" value={form.q10_amount} onChange={e => set("q10_amount", e.target.value)} placeholder="0.00" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Q11 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">11</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to travel away from the municipal or metropolitan area?</p>
                    <YesNo value={form.q11} onChange={v => set("q11", v)} />
                  </div>
                </div>
              </div>

              {/* Q12 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">12</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to use their personal vehicle in the course of their employment?</p>
                    <YesNo value={form.q12} onChange={v => set("q12", v)} />
                  </div>
                </div>
              </div>

              {/* Q13 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">13</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Did this employee receive or is this employee entitled to receive a non-accountable allowance or reimbursement?</p>
                    <YesNo value={form.q13} onChange={v => set("q13", v)} />
                  </div>
                </div>
              </div>

              {/* Q14 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-[10px] font-bold text-gray-400 mt-0.5 w-4 shrink-0">14</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 mb-2">Was this employee required to pay membership fees or professional dues as a condition of their employment?</p>
                    <YesNo value={form.q14} onChange={v => set("q14", v)} />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Part D ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-white text-[10px] font-bold">D</span>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Part D — Employer Certification</span>
            </div>
            <div className="pl-8 grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Authorized Person — Last and First Name</label>
                <input className={inp} value={form.authName} onChange={e => set("authName", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Title</label>
                <input className={inp} value={form.authTitle} onChange={e => set("authTitle", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Date</label>
                <input className={inp} type="date" value={form.authDate} onChange={e => set("authDate", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Telephone</label>
                <input className={inp} value={form.authPhone} onChange={e => set("authPhone", e.target.value)} placeholder="(705) 555-0100" />
              </div>
            </div>
            <div className="pl-8 mt-3">
              <div className="text-[10px] text-gray-500 leading-relaxed p-3 bg-gray-50 rounded-lg border border-gray-200">
                I certify that the information given in this form is, to the best of my knowledge, correct and complete, and that this employee was required to pay the expenses mentioned.
              </div>
            </div>
          </div>

          {/* ── Part E ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center text-white text-[10px] font-bold">E</span>
              <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Part E — Employee Certification</span>
            </div>
            <div className="pl-8 text-[10px] text-gray-500 mb-3 leading-relaxed">
              This section is completed by the employee. The employee certifies that the information on this form is correct.
            </div>
            <div className="pl-8 grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Employee Name</label>
                <input className={`${inp} bg-gray-50 cursor-default`} value={`${form.firstName} ${form.lastName}`.trim()} readOnly />
              </div>
              <div>
                <label className={lbl}>Social Insurance Number</label>
                <input className={inp} value={form.empSIN} onChange={e => set("empSIN", e.target.value)} placeholder="000-000-000" />
              </div>
              <div>
                <label className={lbl}>Date</label>
                <input className={inp} type="date" value={form.empDate} onChange={e => set("empDate", e.target.value)} />
              </div>
              <div className="col-span-3">
                <label className={lbl}>Home Address</label>
                <input className={inp} value={form.empAddress} onChange={e => set("empAddress", e.target.value)} placeholder="123 Main St, City, ON  X0X 0X0" />
              </div>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <div className="flex-1" />
          {saved && (
            <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              ✓ Saved to Documents
            </span>
          )}
          <button
            onClick={handleSaveToDocuments}
            disabled={saving || !form.lastName || !form.taxYear}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-green-600 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "◫ Save to Documents"}
          </button>
          <button
            onClick={handlePrint}
            disabled={!form.lastName || !form.taxYear}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ background: "#c0392b" }}
          >
            ⬇ Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
