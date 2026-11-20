import { describe, it, expect } from "vitest";
import { isServerAlive, pickAliveServer } from "@/lib/landing-server-health";
const now = Date.parse("2026-11-20T16:00:00Z");
const ago = (min: number) => new Date(now - min * 60000).toISOString();
const dead = { id: "old", status: "online", last_heartbeat_at: ago(30), landing_count: 5, capacity: 100 };
const fresh = { id: "new", status: "online", last_heartbeat_at: ago(1), landing_count: 9, capacity: 100 };
describe("Landing-Server-Umzug", () => {
  it("Server ohne Lebenszeichen seit 30 Minuten gilt als tot", () => expect(isServerAlive(dead, now)).toBe(false));
  it("Offline-Server gilt als tot", () => expect(isServerAlive({ ...fresh, status: "offline" }, now)).toBe(false));
  it("tote Landing zieht auf den lebenden Server um", () => expect(pickAliveServer([dead, fresh], "old", now)?.id).toBe("new"));
  it("volle Server werden nicht gewählt", () => expect(pickAliveServer([{ ...fresh, landing_count: 100 }], "old", now)).toBeNull());
});
