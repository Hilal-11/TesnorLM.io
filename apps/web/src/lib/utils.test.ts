import { describe, expect, it } from "vitest";
import { cn, TYPE_ROLES } from "@/lib/utils";

describe("cn", () => {
  it.each(TYPE_ROLES)("keeps text-%s next to a text colour", (role) => {
    expect(cn(`text-${role}`, "text-ink")).toBe(`text-${role} text-ink`);
  });

  it("lets a later type role replace an earlier one", () => {
    expect(cn("text-body", "text-small")).toBe("text-small");
  });

  it("treats TensorLM easings as one group", () => {
    expect(cn("ease-out", "ease-spring")).toBe("ease-spring");
    expect(cn("ease-inout", "ease-in")).toBe("ease-in");
  });

  it("still resolves ordinary conflicts", () => {
    expect(cn("px-4 bg-paper", false, "px-6", { "bg-sheet": true })).toBe("px-6 bg-sheet");
  });
});
