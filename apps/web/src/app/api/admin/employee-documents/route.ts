import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const adminSupabase = getClient();
  const employeeName = req.nextUrl.searchParams.get("employee");
  const category     = req.nextUrl.searchParams.get("category");

  // Allow fetching by category alone (e.g. all payroll reports)
  if (!employeeName && !category) {
    return NextResponse.json({ error: "Missing employee or category param" }, { status: 400 });
  }

  let query = adminSupabase
    .from("documents")
    .select("id,name,category,status,date_added,storage_path,has_file,employee")
    .order("date_added", { ascending: false });

  if (employeeName) query = query.eq("employee", employeeName);
  if (category)     query = query.eq("category", category);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const adminSupabase = getClient();
  const { storagePath } = await req.json();
  if (!storagePath) {
    return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });
  }

  const { data, error } = await adminSupabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600, { download: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
