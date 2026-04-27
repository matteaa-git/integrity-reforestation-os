import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  // Auth check
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!["admin", "supervisor"].includes(callerProfile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { documentId, recipientEmail, recipientName } = await request.json();
  if (!documentId || !recipientEmail) {
    return NextResponse.json({ error: "documentId and recipientEmail are required" }, { status: 400 });
  }

  // Fetch document metadata
  const { data: doc, error: docError } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Generate signed URL (valid 72 hours)
  let downloadUrl: string | null = null;
  if (doc.has_file && doc.storage_path) {
    const { data: signedData } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 60 * 72); // 72 hours
    downloadUrl = signedData?.signedUrl ?? null;
  }

  // Send email
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const senderName = callerProfile?.full_name ?? "Integrity Reforestation";
  const greeting  = recipientName ? `Hi ${recipientName},` : "Hi,";
  const fileSection = downloadUrl
    ? `<p style="margin:16px 0"><a href="${downloadUrl}" style="background:#39de8b;color:#0a2e1a;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Download Document</a></p><p style="color:#666;font-size:12px;margin-top:8px">This link expires in 72 hours.</p>`
    : `<p style="color:#666">No file was attached to this document.</p>`;

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#222">
      <div style="background:#0d1f16;padding:24px;border-radius:12px 12px 0 0">
        <span style="color:#39de8b;font-weight:700;font-size:16px">Integrity Reforestation</span>
      </div>
      <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
        <p style="margin:0 0 8px">${greeting}</p>
        <p style="margin:0 0 20px">${senderName} has sent you a document: <strong>${doc.name}</strong></p>
        ${fileSection}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#888;font-size:12px;margin:0">Integrity Reforestation Admin System</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${senderName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to:   `"${recipientName ?? recipientEmail}" <${recipientEmail}>`,
      subject: `Document: ${doc.name}`,
      html,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Mark document status as pending if it was draft
  if (doc.status === "draft") {
    await supabaseAdmin
      .from("documents")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", documentId);
  }

  return NextResponse.json({ success: true });
}
