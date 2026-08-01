import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseConfig } from "./config";
import {
  activityCookieOptions,
  authCookieOptions,
  policyCookieOptions,
  SESSION_ACTIVITY_COOKIE,
  SESSION_POLICY_COOKIE,
  SESSION_POLICY_VERSION,
  shouldExpireInactiveSession,
} from "./cookie-options";

function redirectWithCookies(url: URL, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  ["cache-control", "expires", "pragma"].forEach((name) => {
    const value = response.headers.get(name);
    if (value) redirectResponse.headers.set(name, value);
  });
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let config: ReturnType<typeof getSupabaseConfig>;
  try {
    config = getSupabaseConfig();
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;
    return NextResponse.next({ request });
  }

  const { url, publishableKey } = config;
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headersToSet).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;
  const isPrivateRoute =
    pathname === "/onboarding" || pathname.startsWith("/app");
  const isAuthRoute = pathname === "/login" || pathname === "/registro";

  if (!isAuthenticated && isPrivateRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return redirectWithCookies(loginUrl, response);
  }

  if (
    shouldExpireInactiveSession({
      isAuthenticated,
      policyValue: request.cookies.get(SESSION_POLICY_COOKIE)?.value,
      activityValue: request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value,
    })
  ) {
    await supabase.auth.signOut({ scope: "local" });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("reason", "inactive");
    const redirectResponse = redirectWithCookies(loginUrl, response);
    redirectResponse.cookies.set(SESSION_ACTIVITY_COOKIE, "", {
      ...activityCookieOptions,
      maxAge: 0,
    });
    redirectResponse.cookies.set(SESSION_POLICY_COOKIE, "", {
      ...policyCookieOptions,
      maxAge: 0,
    });
    return redirectResponse;
  }

  if (isAuthenticated) {
    response.cookies.set(
      SESSION_ACTIVITY_COOKIE,
      String(Math.floor(Date.now() / 1000)),
      activityCookieOptions,
    );
    response.cookies.set(
      SESSION_POLICY_COOKIE,
      SESSION_POLICY_VERSION,
      policyCookieOptions,
    );
  }

  if (isAuthenticated && isAuthRoute) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/app";
    appUrl.search = "";
    return redirectWithCookies(appUrl, response);
  }

  return response;
}
