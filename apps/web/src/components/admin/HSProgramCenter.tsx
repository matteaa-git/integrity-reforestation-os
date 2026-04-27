"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HSDoc {
  id: string;
  filename: string;
  category: string;
  doc_type: "policy" | "form";
  exists: boolean;
}

interface Assignment {
  id: string;
  doc_id: string;
  doc_title: string;
  assigned_to: string;
  assigned_by: string;
  due_date: string;
  note: string;
  status: "pending" | "reviewed";
  created_at: string;
}

interface Submission {
  id: string;
  form_type: string;
  submitted_by: string;
  role: string;
  data: Record<string, unknown>;
  notes: string;
  created_at: string;
}

type Tab = "library" | "submissions" | "assignments";

// ── Digital form schemas ───────────────────────────────────────────────────────

interface ChecklistRow {
  item: string;
  status: "OK" | "Action Required" | "N/A";
  notes: string;
}

interface AttendeeRow {
  name: string;
  position: string;
  signature: string;
}

interface ActionRow {
  item: string;
  assigned_to: string;
  due_date: string;
}

const DIGITAL_FORM_IDS = new Set([
  "incident-report-2026",
  "formal-safety-concern-report",
  "worksite-hazard-inspection-form",
  "camp-hazard-inspection-form",
  "safety-meeting-attendance-record",
  "jhsc-meeting-minutes",
  "workplace-investigation-report-2026",
]);

const CATEGORIES = [
  "All",
  "Administrative & General",
  "Emergency Response",
  "Equipment",
  "Fire Safety",
  "First Aid",
  "Hazard Identification",
  "Hazardous Materials",
  "Human & Wellness",
  "JHSC",
  "Low Risk",
  "Required Postings",
  "Weather & Environment",
];

const ROLES = ["Admin", "Supervisor", "Crew Boss"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanTitle(filename: string) {
  return filename.replace(/\.(docx|xlsx|pdf)$/i, "");
}

function extColor(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return { bg: "bg-red-50 text-red-600", label: "PDF" };
  if (ext === "xlsx") return { bg: "bg-green-50 text-green-600", label: "XLSX" };
  return { bg: "bg-blue-50 text-blue-600", label: "DOCX" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5">
      {children}
    </label>
  );
}

function SInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
    />
  );
}

function STextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 resize-y font-sans"
    />
  );
}

function SSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary/50"
    >
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Checklist table ───────────────────────────────────────────────────────────

function ChecklistTable({ rows, onChange }: {
  rows: ChecklistRow[];
  onChange: (rows: ChecklistRow[]) => void;
}) {
  const update = (i: number, field: keyof ChecklistRow, val: string) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(next);
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-secondary">
            <th className="text-left px-3 py-2 text-text-tertiary font-semibold w-1/2">Item</th>
            <th className="text-left px-3 py-2 text-text-tertiary font-semibold w-32">Status</th>
            <th className="text-left px-3 py-2 text-text-tertiary font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-1.5 text-text-primary">{row.item}</td>
              <td className="px-3 py-1.5">
                <select
                  value={row.status}
                  onChange={e => update(i, "status", e.target.value)}
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-[11px] text-text-primary focus:outline-none"
                >
                  {["OK", "Action Required", "N/A"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td className="px-3 py-1.5">
                <input
                  value={row.notes}
                  onChange={e => update(i, "notes", e.target.value)}
                  placeholder="Notes…"
                  className="w-full bg-surface border border-border rounded px-2 py-1 text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Signature pad ─────────────────────────────────────────────────────────────

function SignaturePad({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const hasStrokes = useRef(false);

  // Draw existing signature if value provided (e.g. re-render)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, []); // only on mount

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#0d1f0f";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    hasStrokes.current = true;
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas && hasStrokes.current) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onChange("");
  };

  return (
    <div className="space-y-1.5">
      <div className="relative rounded-xl border-2 border-border overflow-hidden bg-white"
        style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full block cursor-crosshair"
          style={{ height: 120 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] text-gray-300 select-none">Sign here</span>
          </div>
        )}
        <button
          type="button"
          onClick={clear}
          className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-1 rounded-md border border-border bg-surface text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          Clear
        </button>
      </div>
      <p className="text-[10px] text-text-tertiary">Draw your signature using your mouse or finger</p>
    </div>
  );
}

// ── Digital forms ─────────────────────────────────────────────────────────────

function DigitalForm({ docId, docTitle, onSubmit, onClose }: {
  docId: string;
  docTitle: string;
  onSubmit: (formType: string, submittedBy: string, role: string, data: Record<string, unknown>, notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterRole, setSubmitterRole] = useState("");
  const [signature, setSignature] = useState("");
  const [notes, setNotes] = useState("");

  // Form-specific state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [injuredName, setInjuredName] = useState("");
  const [injuredPosition, setInjuredPosition] = useState("");
  const [witnesses, setWitnesses] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [severity, setSeverity] = useState("");

  const [concernDescription, setConcernDescription] = useState("");
  const [concernLocation, setConcernLocation] = useState("");
  const [concernDate, setConcernDate] = useState(new Date().toISOString().split("T")[0]);
  const [suggestedFix, setSuggestedFix] = useState("");

  const WORKSITE_ITEMS = [
    "Housekeeping / General Cleanliness", "Personal Protective Equipment in use",
    "First Aid kit accessible and stocked", "Emergency exits clear and marked",
    "Equipment in safe working condition", "Hazardous materials properly stored",
    "Fire extinguisher accessible and charged", "Electrical equipment safe / cords secured",
    "Workers following safe work procedures", "Signage / postings visible and current",
  ];
  const [worksiteRows, setWorksiteRows] = useState<ChecklistRow[]>(
    WORKSITE_ITEMS.map(item => ({ item, status: "OK", notes: "" }))
  );

  const CAMP_ITEMS = [
    "Kitchen / food storage area clean", "Sleeping areas clean and organized",
    "Washroom / shower facilities sanitary", "Garbage properly disposed",
    "Fire extinguisher present and charged", "Smoke detectors functional",
    "First Aid kit stocked and accessible", "Emergency contact posted",
    "Generator / fuel stored safely", "Pathways / common areas clear",
  ];
  const [campRows, setCampRows] = useState<ChecklistRow[]>(
    CAMP_ITEMS.map(item => ({ item, status: "OK", notes: "" }))
  );

  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingTopics, setMeetingTopics] = useState("");
  const [attendees, setAttendees] = useState<AttendeeRow[]>([
    { name: "", position: "", signature: "" },
    { name: "", position: "", signature: "" },
  ]);

  const [jhscDate, setJhscDate] = useState(new Date().toISOString().split("T")[0]);
  const [jhscAttendees, setJhscAttendees] = useState("");
  const [jhscAgenda, setJhscAgenda] = useState("");
  const [jhscDiscussion, setJhscDiscussion] = useState("");
  const [actionItems, setActionItems] = useState<ActionRow[]>([
    { item: "", assigned_to: "", due_date: "" },
  ]);
  const [nextMeeting, setNextMeeting] = useState("");

  const [investigationDate, setInvestigationDate] = useState(new Date().toISOString().split("T")[0]);
  const [investigationLocation, setInvestigationLocation] = useState("");
  const [investigationDescription, setInvestigationDescription] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [investigationCorrectiveAction, setInvestigationCorrectiveAction] = useState("");
  const [investigator, setInvestigator] = useState("");

  const handleSubmit = async () => {
    if (!submitterName.trim() || !submitterRole || !signature) return;
    setSaving(true);
    let data: Record<string, unknown> = {};

    if (docId === "incident-report-2026") {
      data = { date, location, injured_name: injuredName, injured_position: injuredPosition, description, witnesses, immediate_action: immediateAction, corrective_action: correctiveAction, severity };
    } else if (docId === "formal-safety-concern-report") {
      data = { concern_date: concernDate, location: concernLocation, description: concernDescription, suggested_fix: suggestedFix };
    } else if (docId === "worksite-hazard-inspection-form") {
      data = { date, location, checklist: worksiteRows };
    } else if (docId === "camp-hazard-inspection-form") {
      data = { date, location, checklist: campRows };
    } else if (docId === "safety-meeting-attendance-record") {
      data = { meeting_date: meetingDate, location: meetingLocation, topics: meetingTopics, attendees };
    } else if (docId === "jhsc-meeting-minutes") {
      data = { meeting_date: jhscDate, attendees: jhscAttendees, agenda: jhscAgenda, discussion: jhscDiscussion, action_items: actionItems, next_meeting: nextMeeting };
    } else if (docId === "workplace-investigation-report-2026") {
      data = { date: investigationDate, location: investigationLocation, description: investigationDescription, root_cause: rootCause, corrective_action: investigationCorrectiveAction, investigator };
    }

    data.signature = signature;
    await onSubmit(docId, submitterName, submitterRole, data, notes);
    setSaving(false);
    onClose();
  };

  const field = (label: string, el: React.ReactNode) => (
    <div key={label}>
      <SLabel>{label}</SLabel>
      {el}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Submitter info */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-surface-secondary rounded-xl border border-border">
        <div>
          <SLabel>Your Name *</SLabel>
          <SInput value={submitterName} onChange={setSubmitterName} placeholder="Full name" />
        </div>
        <div>
          <SLabel>Your Role *</SLabel>
          <SSelect value={submitterRole} onChange={setSubmitterRole} options={ROLES} />
        </div>
      </div>

      {/* Form-specific fields */}
      {docId === "incident-report-2026" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Date of Incident", <SInput type="date" value={date} onChange={setDate} />)}
            {field("Location", <SInput value={location} onChange={setLocation} placeholder="Site / camp location" />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Injured Person Name", <SInput value={injuredName} onChange={setInjuredName} placeholder="Full name" />)}
            {field("Position / Role", <SInput value={injuredPosition} onChange={setInjuredPosition} placeholder="Job title" />)}
          </div>
          {field("Severity", <SSelect value={severity} onChange={setSeverity} options={["Near Miss", "First Aid", "Medical Aid", "Lost Time", "Critical"]} />)}
          {field("Description of Incident", <STextarea value={description} onChange={setDescription} placeholder="Describe what happened in detail…" rows={4} />)}
          {field("Witnesses", <SInput value={witnesses} onChange={setWitnesses} placeholder="Names of witnesses" />)}
          {field("Immediate Action Taken", <STextarea value={immediateAction} onChange={setImmediateAction} placeholder="What was done immediately?" />)}
          {field("Corrective Action / Follow-up", <STextarea value={correctiveAction} onChange={setCorrectiveAction} placeholder="Preventive steps going forward…" />)}
        </div>
      )}

      {docId === "formal-safety-concern-report" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Date of Concern", <SInput type="date" value={concernDate} onChange={setConcernDate} />)}
            {field("Location", <SInput value={concernLocation} onChange={setConcernLocation} placeholder="Where did you observe this?" />)}
          </div>
          {field("Description of Safety Concern", <STextarea value={concernDescription} onChange={setConcernDescription} placeholder="Describe the hazard or unsafe condition…" rows={4} />)}
          {field("Suggested Fix / Recommendation", <STextarea value={suggestedFix} onChange={setSuggestedFix} placeholder="How should this be addressed?" />)}
        </div>
      )}

      {docId === "worksite-hazard-inspection-form" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Inspection Date", <SInput type="date" value={date} onChange={setDate} />)}
            {field("Location / Site", <SInput value={location} onChange={setLocation} placeholder="Worksite name or block" />)}
          </div>
          <div>
            <SLabel>Inspection Checklist</SLabel>
            <ChecklistTable rows={worksiteRows} onChange={setWorksiteRows} />
          </div>
        </div>
      )}

      {docId === "camp-hazard-inspection-form" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Inspection Date", <SInput type="date" value={date} onChange={setDate} />)}
            {field("Camp Name / Location", <SInput value={location} onChange={setLocation} placeholder="Camp name" />)}
          </div>
          <div>
            <SLabel>Camp Inspection Checklist</SLabel>
            <ChecklistTable rows={campRows} onChange={setCampRows} />
          </div>
        </div>
      )}

      {docId === "safety-meeting-attendance-record" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Meeting Date", <SInput type="date" value={meetingDate} onChange={setMeetingDate} />)}
            {field("Location", <SInput value={meetingLocation} onChange={setMeetingLocation} placeholder="Where was the meeting held?" />)}
          </div>
          {field("Topics Covered", <STextarea value={meetingTopics} onChange={setMeetingTopics} placeholder="List safety topics discussed…" rows={3} />)}
          <div>
            <SLabel>Attendees</SLabel>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-secondary">
                    {["Name", "Position", "Signature"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-text-tertiary font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {(["name", "position", "signature"] as const).map(f => (
                        <td key={f} className="px-3 py-1.5">
                          <input
                            value={row[f]}
                            onChange={e => setAttendees(prev => prev.map((r, idx) => idx === i ? { ...r, [f]: e.target.value } : r))}
                            placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
                            className="w-full bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setAttendees(p => [...p, { name: "", position: "", signature: "" }])}
              className="mt-1.5 text-[11px] text-primary font-medium hover:underline"
            >
              + Add row
            </button>
          </div>
        </div>
      )}

      {docId === "jhsc-meeting-minutes" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Meeting Date", <SInput type="date" value={jhscDate} onChange={setJhscDate} />)}
            {field("Attendees", <SInput value={jhscAttendees} onChange={setJhscAttendees} placeholder="Names of those present" />)}
          </div>
          {field("Agenda Items", <STextarea value={jhscAgenda} onChange={setJhscAgenda} placeholder="List agenda items…" />)}
          {field("Discussion Summary", <STextarea value={jhscDiscussion} onChange={setJhscDiscussion} placeholder="Summary of discussion…" rows={4} />)}
          <div>
            <SLabel>Action Items</SLabel>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-secondary">
                    {["Action Item", "Assigned To", "Due Date"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-text-tertiary font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        <input value={row.item} onChange={e => setActionItems(p => p.map((r, idx) => idx === i ? { ...r, item: e.target.value } : r))}
                          placeholder="Action…" className="w-full bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input value={row.assigned_to} onChange={e => setActionItems(p => p.map((r, idx) => idx === i ? { ...r, assigned_to: e.target.value } : r))}
                          placeholder="Person…" className="w-full bg-transparent text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="date" value={row.due_date} onChange={e => setActionItems(p => p.map((r, idx) => idx === i ? { ...r, due_date: e.target.value } : r))}
                          className="w-full bg-transparent text-[11px] text-text-primary focus:outline-none" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setActionItems(p => [...p, { item: "", assigned_to: "", due_date: "" }])}
              className="mt-1.5 text-[11px] text-primary font-medium hover:underline">
              + Add row
            </button>
          </div>
          {field("Next Meeting Date", <SInput type="date" value={nextMeeting} onChange={setNextMeeting} />)}
        </div>
      )}

      {docId === "workplace-investigation-report-2026" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Investigation Date", <SInput type="date" value={investigationDate} onChange={setInvestigationDate} />)}
            {field("Location", <SInput value={investigationLocation} onChange={setInvestigationLocation} placeholder="Where did the incident occur?" />)}
          </div>
          {field("Incident Description", <STextarea value={investigationDescription} onChange={setInvestigationDescription} placeholder="Describe the incident being investigated…" rows={3} />)}
          {field("Root Cause Analysis", <STextarea value={rootCause} onChange={setRootCause} placeholder="What were the root causes?" rows={3} />)}
          {field("Corrective Actions", <STextarea value={investigationCorrectiveAction} onChange={setInvestigationCorrectiveAction} placeholder="What actions will prevent recurrence?" rows={3} />)}
          {field("Lead Investigator", <SInput value={investigator} onChange={setInvestigator} placeholder="Name of investigator" />)}
        </div>
      )}

      {/* Notes */}
      <div>
        <SLabel>Additional Notes</SLabel>
        <STextarea value={notes} onChange={setNotes} placeholder="Any additional context…" rows={2} />
      </div>

      {/* Signature */}
      <div>
        <SLabel>Signature *</SLabel>
        <SignaturePad value={signature} onChange={setSignature} />
        {!signature && (
          <p className="mt-1 text-[10px] text-red-500">A signature is required to submit this form</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <button onClick={onClose}
          className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition-colors">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving || !submitterName.trim() || !submitterRole || !signature}
          className="px-5 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
          {saving ? "Submitting…" : "Submit Form"}
        </button>
      </div>
    </div>
  );
}

// ── Submission viewer ─────────────────────────────────────────────────────────

function SubmissionViewer({ sub, onClose }: { sub: Submission; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 p-4 bg-surface-secondary rounded-xl border border-border">
        {([
          ["Submitted By", sub.submitted_by],
          ["Role", sub.role],
          ["Date", new Date(sub.created_at).toLocaleString()],
          ["Form Type", sub.form_type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-0.5">{k}</div>
            <div className="text-sm text-text-primary font-medium">{v}</div>
          </div>
        ))}
      </div>
      <div className="bg-surface rounded-xl border border-border p-4 max-h-80 overflow-y-auto space-y-3">
        {Object.entries(sub.data).map(([k, v]) => {
          if (k === "signature" && typeof v === "string" && v.startsWith("data:image")) {
            return (
              <div key={k}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">Signature</div>
                <div className="border border-border rounded-lg overflow-hidden bg-white inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v} alt="Signature" className="block max-w-xs" style={{ height: 80 }} />
                </div>
              </div>
            );
          }
          return (
            <div key={k}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-0.5">
                {k.replace(/_/g, " ")}
              </div>
              <div className="text-xs text-text-secondary whitespace-pre-wrap">
                {Array.isArray(v) ? JSON.stringify(v, null, 2) : String(v ?? "—")}
              </div>
            </div>
          );
        })}
      </div>
      {sub.notes && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1">Notes</div>
          <div className="text-xs text-text-secondary">{sub.notes}</div>
        </div>
      )}
      <div className="flex justify-end pt-2 border-t border-border">
        <button onClick={onClose}
          className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="text-sm font-bold text-text-primary">{title}</div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none transition-colors">✕</button>
        </div>
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Document preview ──────────────────────────────────────────────────────────

function PreviewModal({ doc, onClose, onDownload }: {
  doc: HSDoc;
  onClose: () => void;
  onDownload: () => void;
}) {
  const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
  const previewUrl = `${API_BASE}/hs/documents/${doc.id}/preview`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl flex flex-col shadow-xl" style={{ height: "88vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-text-primary truncate">{cleanTitle(doc.filename)}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-text-tertiary">{doc.category}</span>
              <span className="text-text-tertiary">·</span>
              <span className={`text-[10px] font-semibold ${doc.doc_type === "form" ? "text-green-600" : "text-blue-600"}`}>
                {doc.doc_type === "form" ? "Form" : "Policy"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition-colors">
              ↓ Download
            </button>
            <button onClick={onClose}
              className="text-text-tertiary hover:text-text-primary text-lg leading-none transition-colors ml-2">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-b-2xl">
          {isPdf ? (
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title={doc.filename}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-5 p-8 bg-surface-secondary">
              <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl font-bold text-blue-500">
                {doc.filename.split(".").pop()?.toUpperCase()}
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-text-primary mb-1">{cleanTitle(doc.filename)}</div>
                <div className="text-xs text-text-tertiary max-w-xs">
                  Preview is not available for Word and Excel files. Download the file to open it in Microsoft Office or a compatible app.
                </div>
              </div>
              <button onClick={onDownload}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-colors"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                ↓ Download to View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Assign modal ──────────────────────────────────────────────────────────────

function AssignModal({ doc, onClose, onAssigned }: {
  doc: HSDoc;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [assignedTo, setAssignedTo] = useState("");
  const [assignedBy, setAssignedBy] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleAssign = async () => {
    if (!assignedTo.trim() || !assignedBy.trim()) return;
    setSaving(true);
    await fetch(`${API_BASE}/hs/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_id: doc.id,
        doc_title: cleanTitle(doc.filename),
        assigned_to: assignedTo.trim(),
        assigned_by: assignedBy.trim(),
        due_date: dueDate,
        note,
      }),
    });
    setSaving(false);
    setDone(true);
    onAssigned();
  };

  return (
    <Modal title={`Assign Document`} onClose={onClose}>
      {done ? (
        <div className="py-10 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
            ✓
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-text-primary">Document Assigned</div>
            <div className="text-xs text-text-tertiary mt-1">
              <span className="font-semibold text-text-secondary">{cleanTitle(doc.filename)}</span> has been assigned to{" "}
              <span className="font-semibold text-text-secondary">{assignedTo}</span>.
            </div>
          </div>
          <button onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-lg"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Document being assigned */}
          <div className="p-3 bg-surface-secondary rounded-xl border border-border flex items-center gap-3">
            <div className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded ${extColor(doc.filename).bg}`}>
              {extColor(doc.filename).label}
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">{cleanTitle(doc.filename)}</div>
              <div className="text-[10px] text-text-tertiary">{doc.category}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <SLabel>Assign To *</SLabel>
              <SInput value={assignedTo} onChange={setAssignedTo} placeholder="Employee name" />
            </div>
            <div>
              <SLabel>Assigned By *</SLabel>
              <SInput value={assignedBy} onChange={setAssignedBy} placeholder="Your name" />
            </div>
          </div>
          <div>
            <SLabel>Due Date</SLabel>
            <SInput type="date" value={dueDate} onChange={setDueDate} />
          </div>
          <div>
            <SLabel>Note / Instructions</SLabel>
            <STextarea value={note} onChange={setNote} placeholder="Any instructions for the recipient…" rows={3} />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <button onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition-colors">
              Cancel
            </button>
            <button onClick={handleAssign} disabled={saving || !assignedTo.trim() || !assignedBy.trim()}
              className="px-5 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
              {saving ? "Assigning…" : "Assign Document"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HSProgramCenter() {
  const [tab, setTab] = useState<Tab>("library");
  const [docs, setDocs] = useState<HSDoc[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filterType, setFilterType] = useState<"all" | "policy" | "form">("all");
  const [search, setSearch] = useState("");

  const [fillDoc, setFillDoc] = useState<HSDoc | null>(null);
  const [previewDoc, setPreviewDoc] = useState<HSDoc | null>(null);
  const [assignDoc, setAssignDoc] = useState<HSDoc | null>(null);
  const [viewSub, setViewSub] = useState<Submission | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/hs/documents`);
      const d = await r.json();
      setDocs(d.documents || []);
    } catch { /* ignore */ }
  }, []);

  const fetchSubs = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/hs/submissions`);
      const d = await r.json();
      setSubmissions(d.submissions || []);
    } catch { /* ignore */ }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/hs/assignments`);
      const d = await r.json();
      setAssignments(d.assignments || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchDocs(), fetchSubs(), fetchAssignments()]).finally(() => setLoading(false));
  }, [fetchDocs, fetchSubs, fetchAssignments]);

  const handleMarkReviewed = async (id: string) => {
    await fetch(`${API_BASE}/hs/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    });
    await fetchAssignments();
  };

  const handleDeleteAssignment = async (id: string) => {
    await fetch(`${API_BASE}/hs/assignments/${id}`, { method: "DELETE" });
    await fetchAssignments();
  };

  const handleDownload = (doc: HSDoc) => {
    const a = document.createElement("a");
    a.href = `${API_BASE}/hs/documents/${doc.id}/file`;
    a.download = doc.filename;
    a.click();
  };

  const handleSubmit = async (formType: string, submittedBy: string, role: string, data: Record<string, unknown>, notes: string) => {
    await fetch(`${API_BASE}/hs/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form_type: formType, submitted_by: submittedBy, role, data, notes }),
    });
    await fetchSubs();
  };

  const filtered = docs.filter(d => {
    if (selectedCategory !== "All" && d.category !== selectedCategory) return false;
    if (filterType !== "all" && d.doc_type !== filterType) return false;
    if (search && !d.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-sm font-bold text-text-primary">Health &amp; Safety Program</div>
          <div className="text-xs text-text-tertiary mt-0.5">
            {docs.length} documents · {submissions.length} submissions · {assignments.filter(a => a.status === "pending").length} pending assignments
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {([["library", "Document Library"], ["submissions", "Submitted Forms"], ["assignments", "Assignments"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="px-4 py-2.5 text-xs font-semibold transition-colors -mb-px"
            style={{
              color: tab === id ? "var(--color-primary)" : "var(--color-text-tertiary)",
              borderBottom: tab === id ? "2px solid var(--color-primary)" : "2px solid transparent",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Document Library ── */}
      {tab === "library" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <input
              placeholder="Search documents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
            />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-primary/50"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c === "All" ? `All Categories (${docs.length})` : `${c} (${docs.filter(d => d.category === c).length})`}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {(["all", "policy", "form"] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className="px-3 py-2 text-[11px] font-semibold rounded-lg border transition-colors"
                  style={{
                    background: filterType === t ? "var(--color-primary)" : "var(--color-surface)",
                    color: filterType === t ? "var(--color-primary-deep)" : "var(--color-text-secondary)",
                    borderColor: filterType === t ? "var(--color-primary)" : "var(--color-border)",
                  }}>
                  {t === "all" ? "All" : t === "policy" ? "Policies" : "Forms"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-xs text-text-tertiary">Loading documents…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-xl border-2 border-dashed border-border">
              <div className="text-2xl opacity-20 mb-2">⚕</div>
              <div className="text-sm font-semibold text-text-secondary">No documents found</div>
              <div className="text-xs text-text-tertiary mt-1">Try adjusting your filters</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(doc => {
                const ext = extColor(doc.filename);
                const canFill = doc.doc_type === "form" && DIGITAL_FORM_IDS.has(doc.id);
                return (
                  <div key={`${doc.id}-${doc.category}`}
                    className="bg-surface border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col gap-3">
                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      <div className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${ext.bg}`}>
                        {ext.label}
                      </div>
                      <div className="text-xs font-semibold text-text-primary leading-snug flex-1">
                        {cleanTitle(doc.filename)}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface-secondary text-text-tertiary">
                        {doc.category}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${doc.doc_type === "form" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                        {doc.doc_type === "form" ? "Form" : "Policy"}
                      </span>
                      {!doc.exists && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600">Not found</span>
                      )}
                    </div>

                    {/* Actions row 1 */}
                    <div className="flex gap-1.5 mt-auto">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        disabled={!doc.exists}
                        className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ◫ View
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={!doc.exists}
                        className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ↓ Download
                      </button>
                    </div>
                    {/* Actions row 2 */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setAssignDoc(doc)}
                        className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg border border-border bg-surface-secondary text-text-secondary hover:bg-surface-tertiary transition-colors"
                      >
                        ◉ Assign
                      </button>
                      {canFill && (
                        <button onClick={() => setFillDoc(doc)}
                          className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors"
                          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                          ✎ Fill Out
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Submitted Forms ── */}
      {tab === "submissions" && (
        <>
          {submissions.length === 0 ? (
            <div className="text-center py-16 rounded-xl border-2 border-dashed border-border">
              <div className="text-2xl opacity-20 mb-2">◫</div>
              <div className="text-sm font-semibold text-text-secondary">No forms submitted yet</div>
              <div className="text-xs text-text-tertiary mt-1">Use &ldquo;Fill Out&rdquo; on any form in the Document Library</div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-secondary border-b border-border">
                    {["Form", "Submitted By", "Role", "Date", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <tr key={sub.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {sub.form_type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{sub.submitted_by}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700">{sub.role}</span>
                      </td>
                      <td className="px-4 py-3 text-text-tertiary">
                        {new Date(sub.created_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setViewSub(sub)}
                          className="px-3 py-1.5 text-[11px] font-semibold border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-secondary transition-colors">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Assignments ── */}
      {tab === "assignments" && (
        <>
          {assignments.length === 0 ? (
            <div className="text-center py-16 rounded-xl border-2 border-dashed border-border">
              <div className="text-2xl opacity-20 mb-2">◉</div>
              <div className="text-sm font-semibold text-text-secondary">No assignments yet</div>
              <div className="text-xs text-text-tertiary mt-1">Use the &ldquo;Assign&rdquo; button on any document card to assign it to a team member</div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-secondary border-b border-border">
                    {["Document", "Assigned To", "Assigned By", "Due Date", "Status", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-text-primary">{a.doc_title}</div>
                        {a.note && <div className="text-[10px] text-text-tertiary mt-0.5 truncate max-w-48">{a.note}</div>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-medium">{a.assigned_to}</td>
                      <td className="px-4 py-3 text-text-tertiary">{a.assigned_by}</td>
                      <td className="px-4 py-3 text-text-tertiary">
                        {a.due_date ? new Date(a.due_date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                          a.status === "reviewed"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>
                          {a.status === "reviewed" ? "✓ Reviewed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {a.status === "pending" && (
                            <button onClick={() => handleMarkReviewed(a.id)}
                              className="px-2.5 py-1 text-[10px] font-semibold border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-secondary transition-colors whitespace-nowrap">
                              Mark Reviewed
                            </button>
                          )}
                          <button onClick={() => handleDeleteAssignment(a.id)}
                            className="px-2.5 py-1 text-[10px] font-semibold border border-red-100 rounded-lg bg-surface text-red-500 hover:bg-red-50 transition-colors">
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {previewDoc && (
        <PreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onDownload={() => handleDownload(previewDoc)}
        />
      )}

      {assignDoc && (
        <AssignModal
          doc={assignDoc}
          onClose={() => setAssignDoc(null)}
          onAssigned={fetchAssignments}
        />
      )}

      {fillDoc && (
        <Modal title={`Fill Out: ${cleanTitle(fillDoc.filename)}`} onClose={() => setFillDoc(null)}>
          <DigitalForm
            docId={fillDoc.id}
            docTitle={cleanTitle(fillDoc.filename)}
            onSubmit={handleSubmit}
            onClose={() => setFillDoc(null)}
          />
        </Modal>
      )}

      {viewSub && (
        <Modal title="Submission Details" onClose={() => setViewSub(null)}>
          <SubmissionViewer sub={viewSub} onClose={() => setViewSub(null)} />
        </Modal>
      )}
    </div>
  );
}
