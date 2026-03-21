import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helpful debugging logs to diagnose why the route may not respond in dev
console.log("[admin/create-user] route module loaded");

// Force Node runtime for predictable server-side behavior in dev
export const runtime = "nodejs";

/**
 * Protected admin route to create a user using the Supabase service role key.
 * - Requires env: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL
 * - Protect with ADMIN_CREATE_SECRET (set in .env.local) to avoid public misuse.
 *
 * Request body JSON: { secret, email, password, name?, mobile?, industry? }
 */

export async function POST(req: Request) {
  try {
    console.log("[admin/create-user] POST received");
    const body = await req.json();
    const { secret, email, password, name, mobile, industry } = body ?? {};

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: "server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
    }

    // simple route protection for development/testing
    if (process.env.ADMIN_CREATE_SECRET && process.env.ADMIN_CREATE_SECRET !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: "email and password are required" }, { status: 400 });
    }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  console.log("[admin/create-user] SUPABASE_SERVICE_ROLE_KEY present:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("[admin/create-user] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("[admin/create-user] request body:", { secret, email, name, mobile, industry });

    // create user as admin and mark email_confirm true so Supabase won't send a confirmation email
    let userId: string | null = null;
    let createData: any = null;
    try {
      const res = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        user_metadata: { name, mobile, industry },
        email_confirm: true,
      });
      createData = res.data;
      if (res.error) throw res.error;
      userId = (res.data as any)?.user?.id ?? null;
    } catch (createErr: any) {
      // if user already exists, find their id and continue to upsert profile/journey
      const msg = String(createErr?.message || createErr || "");
      console.log('[admin/create-user] createUser error:', msg);
      if (msg.toLowerCase().includes('already been registered') || msg.toLowerCase().includes('already exists') || /already registered/i.test(msg)) {
        // lookup existing user id from auth.users via service role
        const { data: existing, error: existingErr } = await supabaseAdmin.from('auth.users').select('id').eq('email', email).maybeSingle();
        if (existingErr) {
          console.error('[admin/create-user] failed to lookup existing user id', existingErr);
          return NextResponse.json({ error: msg }, { status: 400 });
        }
        userId = existing?.id ?? null;
      } else {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    let profileUpsertResult = null;
    let journeyUpsertResult = null;

    if (userId) {
      // create profile and journey rows server-side
      const { data: pData, error: pErr } = await supabaseAdmin
        .from("profiles")
        // ensure `id` column (if present and non-nullable) is populated with the user's uuid
        .upsert({ id: userId, user_id: userId, name: name ?? null, mobile: mobile ?? null, industry: industry ?? null, email })
        .select();
      profileUpsertResult = { data: pData ?? null, error: pErr ? pErr.message : null };

      const { data: jData, error: jErr } = await supabaseAdmin
        .from("user_journey")
        .upsert({ user_id: userId, current_step: 1 })
        .select();
      journeyUpsertResult = { data: jData ?? null, error: jErr ? jErr.message : null };
    }

    console.log("[admin/create-user] profileUpsertResult:", profileUpsertResult);
    console.log("[admin/create-user] journeyUpsertResult:", journeyUpsertResult);

    // determine user object to return: prefer createData, otherwise fetch from auth.users
    let userObj = createData?.user ?? null;
    if (!userObj && userId) {
      const { data: fetched, error: fetchErr } = await supabaseAdmin.from('auth.users').select('*').eq('id', userId).maybeSingle();
      if (!fetchErr) userObj = fetched ?? null;
    }

    return NextResponse.json({ user: userObj, profileUpsertResult, journeyUpsertResult });
  } catch (err: any) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
