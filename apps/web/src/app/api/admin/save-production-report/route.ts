import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { html, fileName, crewBoss, date, sizeKb, category, storagePath: customPath } = await req.json();

  if (!html || !crewBoss || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const crewBossSlug = crewBoss.replace(/\s+/g, "_");
  const path = customPath ?? `production-reports/${Date.now()}-${crewBossSlug}-${date}.html`;

  // Upload HTML to storage
  const { error: upErr } = await adminSupabase.storage
    .from("documents")
    .upload(path, Buffer.from(html, "utf-8"), {
      cacheControl: "3600",
      upsert: false,
      contentType: "text/html",
    });

  if (upErr) {
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
  }

  // Insert document record
  const { error: insErr } = await adminSupabase.from("documents").insert({
    name:         fileName,
    category:     category ?? "other",
    employee:     crewBoss,
    status:       "signed",
    size:         `${sizeKb} KB`,
    has_file:     true,
    storage_path: path,
  });

  if (insErr) {
    return NextResponse.json({ error: `DB insert failed: ${insErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path });
}
