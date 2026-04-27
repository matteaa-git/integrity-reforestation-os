"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface TokenData {
  employeeName: string;
  documentName: string;
  documentBlob: string;
  documentType: string;
  dueDate: string;
  note: string | null;
  signed: boolean;
  signedAt: string | null;
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TokenData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreedName, setAgreedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`/api/sign-token?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setLoadError(d.error); return; }
        setData(d);
        if (d.signed) setSubmitted(true);
      })
      .catch(() => setLoadError("Could not load signing request. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Canvas helpers ──────────────────────────────────────────────────────────
  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const pos = getPos(e);
    if (!pos || !lastPos.current) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasSig(true);
  }

  function endDraw() {
    setDrawing(false);
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  }

  async function handleSubmit() {
    if (!hasSig || !agreedName.trim() || submitting) return;
    setSubmitError(null);
    const canvas = canvasRef.current;
    const signaturePng = canvas?.toDataURL("image/png") ?? null;
    setSubmitting(true);
    try {
      const res = await fetch("/api/sign-token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signaturePng, agreedName: agreedName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError((err as Error).message ?? "Submission failed. Please try again or contact HR.");
    } finally {
      setSubmitting(false);
    }
  }

  // Full-screen overlay so it works regardless of app layout
  const wrap: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "#f3f4f6", overflowY: "auto",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    WebkitFontSmoothing: "antialiased",
  };

  if (loading) {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, padding: 32 }}>
          <div style={{ fontSize: 40, opacity: 0.15 }}>✕</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Signing link not found</div>
          <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", maxWidth: 320 }}>{loadError}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>Contact HR at matt@integrity-reforestation.com</div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={wrap}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100%", gap: 16, padding: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Document Signed</div>
          <div style={{ fontSize: 14, color: "#6b7280", textAlign: "center", maxWidth: 340, lineHeight: 1.6 }}>
            <strong>{data?.documentName}</strong> has been signed and submitted successfully. A record has been saved.
          </div>
          <div style={{ padding: "10px 20px", background: "white", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12, color: "#9ca3af" }}>
            Signed on {data?.signedAt ?? new Date().toISOString().slice(0, 10)}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>
            Questions? Contact <a href="mailto:matt@integrity-reforestation.com" style={{ color: "#4f6ef7" }}>matt@integrity-reforestation.com</a>
          </div>
        </div>
      </div>
    );
  }

  const docUrl = data?.documentBlob
    ? `data:${data.documentType};base64,${data.documentBlob}`
    : null;

  const card: React.CSSProperties = {
    background: "white", borderRadius: 16, border: "1px solid #e5e7eb",
    overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.08em", color: "#9ca3af", marginBottom: 8,
  };

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 56px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#4f6ef7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            IR
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Integrity Reforestation</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Document Signature Request</div>
          </div>
        </div>

        {/* Document info card */}
        <div style={card}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={sectionLabel}>Document to Sign</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1.3 }}>{data?.documentName}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 20, flexWrap: "wrap" as const }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                <span style={{ color: "#9ca3af" }}>For: </span>
                <strong style={{ color: "#374151" }}>{data?.employeeName}</strong>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                <span style={{ color: "#9ca3af" }}>Due: </span>
                <strong style={{ color: "#374151" }}>{data?.dueDate}</strong>
              </div>
            </div>
          </div>

          {data?.note && (
            <div style={{ padding: "14px 24px", background: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Note from HR</div>
              <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>{data.note}</div>
            </div>
          )}
        </div>

        {/* Document preview */}
        {docUrl && (
          <div style={{ ...card }}>
            <div style={{ padding: "16px 24px 0" }}>
              <div style={sectionLabel}>Document Preview</div>
            </div>
            {data!.documentType.startsWith("image/") ? (
              <img
                src={docUrl}
                alt={data!.documentName}
                style={{ width: "100%", display: "block", borderRadius: "0 0 16px 16px" }}
              />
            ) : (
              <iframe
                src={docUrl}
                title={data!.documentName}
                style={{ width: "100%", height: 500, border: "none", borderRadius: "0 0 16px 16px", display: "block" }}
              />
            )}
          </div>
        )}

        {/* Signature canvas */}
        <div style={card}>
          <div style={{ padding: "20px 24px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={sectionLabel}>Draw Your Signature</div>
              {hasSig && (
                <button
                  onClick={clearCanvas}
                  style={{ fontSize: 11, color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div style={{ padding: "0 24px 20px" }}>
            <canvas
              ref={canvasRef}
              width={592}
              height={140}
              style={{
                width: "100%", height: 140,
                border: hasSig ? "1.5px solid #d1d5db" : "1.5px dashed #d1d5db",
                borderRadius: 10, cursor: "crosshair", background: "#fafafa",
                touchAction: "none", display: "block",
              }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasSig && (
              <div style={{ textAlign: "center", fontSize: 12, color: "#d1d5db", marginTop: 8 }}>
                Sign using your mouse or finger
              </div>
            )}
          </div>
        </div>

        {/* Full name */}
        <div style={card}>
          <div style={{ padding: "20px 24px" }}>
            <label style={{ ...sectionLabel, display: "block", marginBottom: 10 }}>
              Type Your Full Legal Name
            </label>
            <input
              type="text"
              value={agreedName}
              onChange={e => setAgreedName(e.target.value)}
              placeholder={data?.employeeName ?? "Full name"}
              style={{
                width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10,
                padding: "12px 14px", fontSize: 15, color: "#111827",
                background: "#f9fafb", outline: "none", boxSizing: "border-box" as const,
              }}
            />
          </div>
        </div>

        {/* Legal disclaimer */}
        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.7, marginBottom: 16, padding: "0 4px" }}>
          By clicking "Submit Signature", I confirm I have read and understand the document above and that my electronic signature constitutes a legally binding agreement equivalent to a handwritten signature.
        </div>

        {submitError && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, color: "#b91c1c", marginBottom: 12 }}>
            {submitError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!hasSig || !agreedName.trim() || submitting}
          style={{
            width: "100%", padding: "15px 24px", borderRadius: 12, border: "none",
            background: hasSig && agreedName.trim() && !submitting ? "#4f6ef7" : "#e5e7eb",
            color: hasSig && agreedName.trim() && !submitting ? "white" : "#9ca3af",
            fontSize: 15, fontWeight: 700,
            cursor: hasSig && agreedName.trim() && !submitting ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          {submitting ? "Submitting…" : "✍ Submit Signature"}
        </button>
      </div>
    </div>
  );
}
