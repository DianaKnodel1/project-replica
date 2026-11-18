import { describe, it, expect } from "vitest";
import { compareChats } from "@/lib/chat-sort";

const sortIds = (rows: any[]) => [...rows].sort(compareChats).map((r) => r.id);

describe("Chat-Liste Sortierung", () => {
  it("zuletzt aktive Mitarbeiter stehen oben, nie aktive unten", () => {
    expect(sortIds([
      { id: "nie" },
      { id: "alt", lastSeenAt: "2026-11-01T10:00:00Z" },
      { id: "neu", lastSeenAt: "2026-11-18T10:00:00Z" },
    ])).toEqual(["neu", "alt", "nie"]);
  });
  it("gesperrte Mitarbeiter stehen ganz unten, auch wenn kürzlich aktiv", () => {
    expect(sortIds([
      { id: "gesperrt", blocked: true, lastSeenAt: "2026-11-18T12:00:00Z" },
      { id: "nie" },
    ])).toEqual(["nie", "gesperrt"]);
  });
  it("eskalierte und offene Chats bleiben über aktiven", () => {
    expect(sortIds([
      { id: "aktiv", lastSeenAt: "2026-11-18T12:00:00Z" },
      { id: "offen", openCount: 1, openSince: "2026-11-10T00:00:00Z" },
      { id: "eskaliert", status: "escalated" },
    ])).toEqual(["eskaliert", "offen", "aktiv"]);
  });
});
