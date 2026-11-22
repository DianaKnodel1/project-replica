import { describe, it, expect } from "vitest";
import { statusAfterAppointment, statusAfterCall, nextAppointment, isCallToday, historyLine } from "@/lib/call-list";

const now = new Date("2026-11-22T10:00:00");
describe("Anruf-Liste", () => {
  it("neuer Termin setzt Stand auf Termin vereinbart", () => expect(statusAfterAppointment("nicht_erreicht")).toBe("termin"));
  it("Anrufergebnis wird neuer Stand", () => expect(statusAfterCall("macht_mit")).toBe("macht_mit"));
  it("nächster Termin ist der früheste offene in der Zukunft", () => {
    const a = [
      { scheduled_at: "2026-11-25T14:00:00", done: false },
      { scheduled_at: "2026-11-23T09:00:00", done: false },
      { scheduled_at: "2026-11-22T12:00:00", done: true },
    ];
    expect(nextAppointment(a, now.getTime())?.scheduled_at).toBe("2026-11-23T09:00:00");
  });
  it("Termin heute zählt als heute anrufen", () => expect(isCallToday("termin", { scheduled_at: "2026-11-22T15:00:00" }, now)).toBe(true));
  it("Rückruf ohne Termin zählt als heute anrufen", () => expect(isCallToday("rueckruf", null, now)).toBe(true));
  it("Verlauf in zeitlicher Reihenfolge", () =>
    expect(historyLine([
      { result: "rueckruf", created_at: "2026-11-21T10:00:00" },
      { result: "nicht_erreicht", created_at: "2026-11-20T10:00:00" },
    ])).toBe("20.11. Nicht erreicht → 21.11. Rückruf"));
});
