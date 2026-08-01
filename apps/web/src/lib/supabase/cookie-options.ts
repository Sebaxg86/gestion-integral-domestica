export const SESSION_INACTIVITY_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_POLICY_COOKIE = "gid-session-policy";
export const SESSION_ACTIVITY_COOKIE = "gid-session-activity";
export const SESSION_POLICY_VERSION = "v1";

export const authCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export const activityCookieOptions = {
  ...authCookieOptions,
  httpOnly: true,
  maxAge: SESSION_INACTIVITY_SECONDS,
};

export const policyCookieOptions = {
  ...authCookieOptions,
  httpOnly: true,
  maxAge: 400 * 24 * 60 * 60,
};

export function shouldExpireInactiveSession({
  isAuthenticated,
  policyValue,
  activityValue,
}: {
  isAuthenticated: boolean;
  policyValue?: string;
  activityValue?: string;
}) {
  return (
    isAuthenticated &&
    policyValue === SESSION_POLICY_VERSION &&
    !activityValue
  );
}
