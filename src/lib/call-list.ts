// Anruf-Liste: Stände und Regeln (gemeinsam für Liste, Termin- und Anruf-Dialog).
export const CALL_STATUSES = [
  { key: "neu", label: "Neu" },
  { key: "termin", label: "Termin vereinbart" },
  { key: "nicht_erreicht", label: "Nicht erreicht" },
  { key: "rueckruf", label: "Rückruf" },
  { key: "interessiert", label: "Interessiert" },
  { key: "macht_mit", label: "Macht mit" },
  { key: "kein_interesse", label: "Kein Interesse" },
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number]["key"];
export const CALL_RESULTS = CALL_STATUSES.filter((s) => s.key !== "neu" && s.key !== "termin");
export const callStatusLabel = (k: string | null | undefined) =>
  CALL_STATUSES.find((s) => s.key === k)?.label ?? "Neu";

/** Neuer Telefontermin: Stand springt auf „Termin vereinbart“. */
export function statusAfterAppointment(_current: CallStatus | null): CallStatus {
  return "termin";
}
/** Nach einem Anruf gilt das eingetragene Ergebnis als neuer Stand. */
export function statusAfterCall(result: CallStatus): CallStatus {
  return result;
}

/** Nächster offener Termin (ab jetzt) einer Person. */
export function nextAppointment<T extends { scheduled_at: string; done: boolean }>(items: T[], now = Date.now()): T | null {
  return items.filter((a) => !a.done && new Date(a.scheduled_at).getTime() >= now - 60 * 60 * 1000)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null;
}

/** „Heute anrufen“: Termin heute oder Rückruf/Nicht erreicht ohne künftigen Termin. */
export function isCallToday(status: CallStatus | null, next: { scheduled_at: string } | null, now = new Date()): boolean {
  if (next) return new Date(next.scheduled_at).toDateString() === now.toDateString();
  return status === "rueckruf" || status === "nicht_erreicht";
}

/** Verlauf als kurze Zeile: „20.11. Nicht erreicht → 21.11. Rückruf“. */
export function historyLine(log: { result: string; created_at: string }[]): string {
  return [...log].sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((l) => `${new Date(l.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${callStatusLabel(l.result)}`)
    .join(" → ");
}
