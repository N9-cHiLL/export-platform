import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side email-existence check to show a clear signup warning.
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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { error: "server misconfigured: missing Supabase env vars" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    console.log("[check-email] checking existence for:", normalizedEmail);

    // Query auth.users with service role. We only need existence (not the user record).
    // Prefer schema-qualified query: auth schema -> users table.
    let exists = false;
    let queryError: string | null = null;

    try {
      const primary = await supabaseAdmin
        .schema("auth")
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .limit(1);

      if (primary.error) {
        console.error("[check-email] primary query error:", primary.error.message);
        queryError = primary.error.message;
      } else {
        exists = (primary.data?.length ?? 0) > 0;
      }
    } catch (e: any) {
      console.error("[check-email] primary query exception:", String(e?.message || e));
      queryError = String(e?.message || e);
    }

    if (!exists && queryError) {
      // Fallback: sometimes supabase clients may allow dotted table naming.
      try {
        const fallback = await supabaseAdmin
          .from("auth.users")
          .select("id")
          .eq("email", normalizedEmail)
          .limit(1);

        if (fallback.error) {
          console.error("[check-email] fallback query error:", fallback.error.message);
          queryError = queryError ?? fallback.error.message;
        } else {
          exists = (fallback.data?.length ?? 0) > 0;
        }
      } catch (e: any) {
        console.error("[check-email] fallback query exception:", String(e?.message || e));
        queryError = queryError ?? String(e?.message || e);
      }
    }

    console.log("[check-email] exists:", exists);
    return NextResponse.json({ exists, error: queryError });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

