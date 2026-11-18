import { afterEach, describe, expect, it, vi } from "vitest";
import { uuidv4 } from "../uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * The fallback branch is the one that actually matters: `crypto.randomUUID` is undefined
 * whenever the app is served over plain HTTP on anything other than localhost (a LAN IP, or a
 * hostname like ride.192.168.1.39.nip.io). Tests run in a secure-ish context where randomUUID
 * exists, so the fallback has to be forced to be covered at all.
 */
describe("uuidv4", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a valid v4 UUID when crypto.randomUUID is available", () => {
    expect(uuidv4()).toMatch(V4);
  });

  it("returns a valid v4 UUID when crypto.randomUUID is missing (insecure context)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });
    expect(globalThis.crypto.randomUUID).toBeUndefined();
    expect(uuidv4()).toMatch(V4);
  });

  it("sets the version and variant bits correctly in the fallback", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });
    for (let i = 0; i < 200; i++) {
      const uuid = uuidv4();
      expect(uuid[14]).toBe("4");
      expect(["8", "9", "a", "b"]).toContain(uuid[19]);
    }
  });

  it("does not collide across many calls in the fallback", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });
    const seen = new Set(Array.from({ length: 5000 }, () => uuidv4()));
    expect(seen.size).toBe(5000);
  });
});
