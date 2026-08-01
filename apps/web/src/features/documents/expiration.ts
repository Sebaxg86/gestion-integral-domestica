export type ExpirationStatus = "expired" | "today" | "upcoming" | "later";

export function getLocalDate(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function daysUntil(expirationDate: string, localDate: string) {
  const expiration = Date.parse(`${expirationDate}T00:00:00Z`);
  const today = Date.parse(`${localDate}T00:00:00Z`);
  return Math.round((expiration - today) / 86_400_000);
}

export function classifyExpiration(
  expirationDate: string,
  localDate: string,
): ExpirationStatus {
  const difference = daysUntil(expirationDate, localDate);
  if (difference < 0) return "expired";
  if (difference === 0) return "today";
  if (difference <= 30) return "upcoming";
  return "later";
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
