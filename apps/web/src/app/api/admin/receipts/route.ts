import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getCurrentUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: roleData } = await supabase.rpc("get_my_role");
  return { user, role: (roleData as string) ?? "crew_boss" };
}

// GET — admins/supervisors get all receipts, others get only their own
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();
  let query = db.from("receipts").select("*").order("date", { ascending: false });

  if (session.role !== "admin" && session.role !== "supervisor") {
    query = query.eq("submitted_by", session.user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

function receiptFields(body: Record<string, unknown>, submittedBy: string) {
  return {
    submitted_by:      submittedBy,
    submitted_by_name: body.submitted_by_name ?? "",
    employee:          body.employee ?? "",
    cost:              body.cost ?? null,
    date:              body.date ?? "",
    time:              body.time ?? "",
    expense_type:      body.expenseType ?? "",
    litres:            body.litres ?? null,
    price_per_litre:   body.pricePerLitre ?? null,
    total:             body.total ?? null,
    vehicle:           body.vehicle ?? "",
    items:             body.items ?? "",
    credit_card:       body.creditCard ?? "",
    odometer:          body.odometer ?? "",
    location:          body.location ?? "",
    notes:             body.notes ?? "",
    receipt_provided:  body.receiptProvided ?? "Yes",
    image_url:         body.imageUrl ?? "",
  };
}

// POST — create a new receipt
export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = adminDb();

  const { data, error } = await db.from("receipts").insert({
    id: body.id,
    ...receiptFields(body, session.user.id),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PUT — update an existing receipt
export async function PUT(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = adminDb();

  const baseQuery = db.from("receipts").update(receiptFields(body, session.user.id)).eq("id", body.id);
  const finalQuery = (session.role !== "admin" && session.role !== "supervisor")
    ? baseQuery.eq("submitted_by", session.user.id)
    : baseQuery;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (finalQuery as any).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — admin can delete any, others only their own
export async function DELETE(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const db = adminDb();

  let query = db.from("receipts").delete().eq("id", id);
  if (session.role !== "admin" && session.role !== "supervisor") {
    query = query.eq("submitted_by", session.user.id);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
