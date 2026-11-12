import { describe, expect, it } from "vitest";
import { renderScript } from "@/lib/landing-bootstrap-script";

const script = renderScript({
  serverName: "Landing-1",
  serverId: "00000000-0000-0000-0000-000000000000",
  token: "x".repeat(32),
  supabaseUrl: "https://api.example.com",
  supabaseKey: "key",
  portalOrigin: "https://portal.example.com",
  acmeEmail: "admin@example.com",
  clean: false,
});

describe("Landing-Server Bootstrap", () => {
  it("unterstützt Ubuntu/Debian (apt) und AlmaLinux/RHEL (dnf)", () => {
    expect(script).toContain("apt-get install");
    expect(script).toContain("dnf install");
  });

  it("installiert Node.js automatisch, wenn es fehlt", () => {
    expect(script).toContain("nodejs:20");
    expect(script).toContain("setup_20.x");
    expect(script).not.toContain("bitte nodejs installieren");
  });

  it("liest die OS-Kennung zur Laufzeit statt sie einzubetten", () => {
    expect(script).toContain('echo "${ID:-} ${ID_LIKE:-}"');
  });
});
