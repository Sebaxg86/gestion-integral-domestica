import { describe, expect, it } from "vitest";

import {
  SESSION_INACTIVITY_SECONDS,
  SESSION_POLICY_VERSION,
  shouldExpireInactiveSession,
} from "./cookie-options";

describe("política de sesión", () => {
  it("define treinta días como ventana de inactividad", () => {
    expect(SESSION_INACTIVITY_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it("expira una sesión administrada cuando ya no conserva actividad", () => {
    expect(
      shouldExpireInactiveSession({
        isAuthenticated: true,
        policyValue: SESSION_POLICY_VERSION,
      }),
    ).toBe(true);
  });

  it("conserva sesiones activas y migra las sesiones anteriores", () => {
    expect(
      shouldExpireInactiveSession({
        isAuthenticated: true,
        policyValue: SESSION_POLICY_VERSION,
        activityValue: "1785570000",
      }),
    ).toBe(false);
    expect(
      shouldExpireInactiveSession({ isAuthenticated: true }),
    ).toBe(false);
  });
});
