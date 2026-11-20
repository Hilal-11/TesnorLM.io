import { describe, expect, it } from "vitest";
import { fetchEnabledProviders } from "./auth-providers";

const respond = (body: unknown, status = 200) =>
  (async () => Response.json(body, { status })) as unknown as typeof fetch;

describe("enabled social providers", () => {
  it("lists only providers the project turned on", async () => {
    expect(
      await fetchEnabledProviders(
        "http://x",
        "k",
        respond({ external: { google: true, github: false, email: true } }),
      ),
    ).toEqual(["google"]);
  });

  it("shows none when the settings can't be read", async () => {
    expect(await fetchEnabledProviders("http://x", "k", respond({}, 500))).toEqual([]);
    const failing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await fetchEnabledProviders("http://x", "k", failing)).toEqual([]);
  });
});
