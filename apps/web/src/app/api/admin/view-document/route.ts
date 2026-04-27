import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const storagePath = req.nextUrl.searchParams.get("path");
  if (!storagePath) {
    return new NextResponse("Missing path", { status: 400 });
  }

  const { data, error } = await adminSupabase.storage
    .from("documents")
    .download(storagePath);

  if (error || !data) {
    return new NextResponse(error?.message ?? "Not found", { status: 404 });
  }

  const html = await data.text();

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
