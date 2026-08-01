import { describe, expect, it } from "vitest";

import { classifyExpiration, daysUntil, getLocalDate } from "./expiration";

describe("clasificación de vencimientos", () => {
  it.each([
    ["2026-07-30", "expired"],
    ["2026-07-31", "today"],
    ["2026-08-01", "upcoming"],
    ["2026-08-30", "upcoming"],
    ["2026-08-31", "later"],
  ])("clasifica %s como %s", (expirationDate, expected) => {
    expect(classifyExpiration(expirationDate, "2026-07-31")).toBe(expected);
  });

  it("calcula diferencias de días sin depender del horario local", () => {
    expect(daysUntil("2026-08-07", "2026-07-31")).toBe(7);
  });

  it("obtiene el día calendario en la zona de la familia", () => {
    const instant = new Date("2026-08-01T01:00:00.000Z");
    expect(getLocalDate("America/Monterrey", instant)).toBe("2026-07-31");
  });
});
