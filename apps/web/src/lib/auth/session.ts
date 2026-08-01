import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export const getSessionContext = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return null;

  const [{ data: profile }, { data: family }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, email, email_verified_at, version")
      .eq("id", userId)
      .single(),
    supabase
      .from("families")
      .select("id, name, timezone, version")
      .eq("owner_user_id", userId)
      .maybeSingle(),
  ]);

  if (!profile) return null;

  return { userId, profile, family };
});
