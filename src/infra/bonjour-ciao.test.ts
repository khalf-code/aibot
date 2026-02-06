import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({
  logDebug: vi.fn(),
}));

const { ignoreCiaoCancellationRejection } = await import("./bonjour-ciao.js");

describe("ignoreCiaoCancellationRejection", () => {
  it("handles ciao announcement cancelled", () => {
    const err = new Error("Ciao announcement cancelled");
    expect(ignoreCiaoCancellationRejection(err)).toBe(true);
  });

  it("handles AssertionError with IPV4 address change", () => {
    const err = Object.assign(
      new Error("Reached illegal state! IPV4 address change from defined to undefined!"),
      { name: "AssertionError [ERR_ASSERTION]", code: "ERR_ASSERTION" },
    );
    expect(ignoreCiaoCancellationRejection(err)).toBe(true);
  });

  it("handles AssertionError with IPV6 address change", () => {
    const err = Object.assign(
      new Error("Reached illegal state! IPV6 address change from defined to undefined!"),
      { name: "AssertionError [ERR_ASSERTION]", code: "ERR_ASSERTION" },
    );
    expect(ignoreCiaoCancellationRejection(err)).toBe(true);
  });

  it("handles updated network interfaces error", () => {
    const err = new Error("Error during updated network interfaces handling");
    expect(ignoreCiaoCancellationRejection(err)).toBe(true);
  });

  it("handles reached illegal state without specific address detail", () => {
    const err = new Error("Reached illegal state!");
    expect(ignoreCiaoCancellationRejection(err)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(ignoreCiaoCancellationRejection(new Error("ECONNRESET"))).toBe(false);
    expect(ignoreCiaoCancellationRejection(new Error("Something went wrong"))).toBe(false);
    expect(ignoreCiaoCancellationRejection(new TypeError("Cannot read property"))).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(ignoreCiaoCancellationRejection(null)).toBe(false);
    expect(ignoreCiaoCancellationRejection(undefined)).toBe(false);
  });

  it("handles string reasons containing ciao patterns", () => {
    expect(ignoreCiaoCancellationRejection("Ciao announcement cancelled")).toBe(true);
    expect(
      ignoreCiaoCancellationRejection(
        "Reached illegal state! IPV4 address change from defined to undefined!",
      ),
    ).toBe(true);
  });
});
