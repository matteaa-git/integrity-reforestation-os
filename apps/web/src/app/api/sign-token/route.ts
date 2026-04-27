import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

const DATA_DIR = join(process.cwd(), "data");
const TOKEN_FILE = join(DATA_DIR, "sign-tokens.json");

interface SignToken {
  token: string;
  requestId: string;
  employeeName: string;
  employeeEmail: string;
  documentName: string;
  documentBlob: string; // base64
  documentType: string;
  dueDate: string;
  note: string | null;
  createdAt: string;
  signed: boolean;
  signedAt: string | null;
  signaturePng: string | null;
  agreedName: string | null;
}

function readTokens(): SignToken[] {
  try {
    if (!existsSync(TOKEN_FILE)) return [];
    return JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
  } catch { return []; }
}

function writeTokens(tokens: SignToken[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

// POST — create a signing token
export async function POST(req: NextRequest) {
  const { requestId, employeeName, employeeEmail, documentName, documentBlob, documentType, dueDate, note } =
    await req.json();

  if (!requestId || !employeeEmail || !documentName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Remove any existing token for this requestId (re-send scenario)
  const existing = readTokens().filter(t => t.requestId !== requestId);
  const token = randomBytes(24).toString("hex");

  existing.push({
    token,
    requestId,
    employeeName: employeeName ?? "",
    employeeEmail,
    documentName,
    documentBlob: documentBlob ?? "",
    documentType: documentType ?? "application/pdf",
    dueDate: dueDate ?? "",
    note: note ?? null,
    createdAt: new Date().toISOString(),
    signed: false,
    signedAt: null,
    signaturePng: null,
    agreedName: null,
  });
  writeTokens(existing);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return NextResponse.json({ token, signingUrl: `${appUrl}/sign/${token}` });
}

// GET — fetch token data for the signing page, or check status by requestId
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const requestId = req.nextUrl.searchParams.get("requestId");
  const tokens = readTokens();

  // Status check from admin panel
  if (requestId) {
    const entry = tokens.find(t => t.requestId === requestId);
    if (!entry) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, signed: entry.signed, signedAt: entry.signedAt });
  }

  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const entry = tokens.find(t => t.token === token);
  if (!entry) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

  return NextResponse.json({
    employeeName: entry.employeeName,
    documentName: entry.documentName,
    documentBlob: entry.documentBlob,
    documentType: entry.documentType,
    dueDate: entry.dueDate,
    note: entry.note,
    signed: entry.signed,
    signedAt: entry.signedAt,
  });
}

// PATCH — submit signature
export async function PATCH(req: NextRequest) {
  const { token, signaturePng, agreedName } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const tokens = readTokens();
  const idx = tokens.findIndex(t => t.token === token);
  if (idx === -1) return NextResponse.json({ error: "Token not found" }, { status: 404 });
  if (tokens[idx].signed) return NextResponse.json({ error: "Already signed" }, { status: 409 });

  tokens[idx] = {
    ...tokens[idx],
    signed: true,
    signedAt: new Date().toISOString().slice(0, 10),
    signaturePng: signaturePng ?? null,
    agreedName: agreedName ?? null,
  };
  writeTokens(tokens);
  return NextResponse.json({ ok: true });
}
