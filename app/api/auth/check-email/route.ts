import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side email-existence check via GoTrue Admin API (not PostgREST — auth schema is not exposed).
// Note: This enables email enumeration. Only use for development/MVP.
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body?.email;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "server misconfigured: missing Supabase env vars" },
        { status: 500 }
      );
    }

    const base = supabaseUrl.replace(/\/$/, "");
    // GoTrue admin: filter by email (see Supabase/GoTrue admin API docs).
    const adminUrl = `${base}/auth/v1/admin/users?filter=${encodeURIComponent(normalizedEmail)}&per_page=1&page=1`;

    const res = await fetch(adminUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[check-email] admin users HTTP", res.status, text);
      return NextResponse.json(
        { exists: false, error: `Auth admin request failed (${res.status})` },
        { status: 200 }
      );
    }

    const json = (await res.json()) as { users?: unknown[] };
    const users = Array.isArray(json?.users) ? json.users : [];
    let exists = users.length > 0;

    // Fallback: your app stores email on `public.profiles` — catches accounts even if admin filter differs.
    if (!exists) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { data: rows, error: profErr } = await supabase
          .from("profiles")
          .select("email")
          .eq("email", normalizedEmail)
          .limit(1);
        if (!profErr && rows && rows.length > 0) exists = true;
      } catch {
        // ignore
      }
    }

    console.log("[check-email] exists:", exists, "for", normalizedEmail);
    return NextResponse.json({ exists, error: null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[check-email] exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
