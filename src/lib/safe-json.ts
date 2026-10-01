/** Safe JSON parsing for TEXT columns that store stringified JSON.
 * One corrupt row must never 500 an entire list response. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  if (value === "") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export function parseJsonObject(value: unknown): Record<string, any> {
  const parsed = parseJson(value, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, any>)
    : {};
}

export function parseJsonArray<T = any>(value: unknown): T[] {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}
