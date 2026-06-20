import { describe, expect, it } from "vitest";

import { trustedProxyIpConfig } from "./ip-config";

describe("trustedProxyIpConfig", () => {
  it("returns no advanced config when unset (Better Auth keeps its x-forwarded-for default)", () => {
    expect(trustedProxyIpConfig(undefined)).toEqual({});
    expect(trustedProxyIpConfig("")).toEqual({});
  });

  it("points Better Auth at the configured header", () => {
    expect(trustedProxyIpConfig("cf-connecting-ip")).toEqual({
      advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
    });
  });
});
