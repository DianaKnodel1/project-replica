import { describe, it, expect } from "vitest";
import { matchMailsToPeople } from "@/lib/lead-mailing";

describe("matchMailsToPeople", () => {
  const rows = [
    { id: "m1", created_at: "2026-11-01", application_id: null, profile_id: null, peer_email: "Anna@Test.de" },
    { id: "m2", created_at: "2026-11-05", application_id: "app1", profile_id: null, peer_email: "anna@test.de" },
    { id: "m3", created_at: "2026-11-09", application_id: null, profile_id: "prof1", peer_email: "anna@test.de" },
  ];
  const person = { ids: ["app1", "prof1"], emails: ["anna@test.de"] };
  it("Mail nur mit Adresse erscheint bei Bewerber und Mitarbeiter", () => {
    const r = matchMailsToPeople([rows[0]], [{ id: "app1", ...person }, { id: "prof1", ...person }]);
    expect(r.latest.app1?.id).toBe("m1");
    expect(r.latest.prof1?.id).toBe("m1");
  });
  it("Mitarbeiter sieht auch Mails an seine frühere Bewerbung; neueste zuerst", () => {
    const r = matchMailsToPeople(rows, [{ id: "app1", ...person }]);
    expect(r.byPerson.app1.map((m) => m.id)).toEqual(["m3", "m2", "m1"]);
  });
  it("fremde Adresse wird nicht zugeordnet", () => {
    const r = matchMailsToPeople(rows, [{ id: "x", ids: ["app9"], emails: ["bob@test.de"] }]);
    expect(r.latest.x).toBeUndefined();
  });
});
