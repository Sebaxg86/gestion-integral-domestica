"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "./config";
import { authCookieOptions } from "./cookie-options";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  browserClient ??= createBrowserClient(url, publishableKey, {
    cookieOptions: authCookieOptions,
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
  return browserClient;
}
