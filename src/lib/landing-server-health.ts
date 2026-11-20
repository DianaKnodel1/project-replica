// Gesundheitsregel für Landing-Server (gemeinsam für Auswahl und Umzug).
export const HEARTBEAT_STALE_MS = 10 * 60 * 1000;
export type ServerHealthRow = { id: string; status: string; last_heartbeat_at: string | null; landing_count: number; capacity: number };

export function isServerAlive(s: ServerHealthRow | null | undefined, now = Date.now()): boolean {
  if (!s || s.status !== "online" || !s.last_heartbeat_at) return false;
  return now - new Date(s.last_heartbeat_at).getTime() <= HEARTBEAT_STALE_MS;
}

/** Bester lebender Server mit freier Kapazität (am wenigsten belegt), optional ohne den alten. */
export function pickAliveServer<T extends ServerHealthRow>(rows: T[], excludeId?: string | null, now = Date.now()): T | null {
  return rows.filter((s) => s.id !== excludeId && isServerAlive(s, now) && s.landing_count < s.capacity)
    .sort((a, b) => a.landing_count - b.landing_count)[0] ?? null;
}
