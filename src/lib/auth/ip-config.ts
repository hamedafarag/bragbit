/**
 * Better Auth `advanced.ipAddress` config for trusted-proxy client-IP detection
 * (ENH-SEC-03). When `TRUSTED_PROXY_IP_HEADER` is set, point Better Auth at that
 * header; otherwise return `{}` so it keeps its `x-forwarded-for` default. Pure +
 * unit-tested, so the branch is covered without instantiating Better Auth.
 */
export function trustedProxyIpConfig(header: string | undefined): {
  advanced?: { ipAddress: { ipAddressHeaders: string[] } };
} {
  return header ? { advanced: { ipAddress: { ipAddressHeaders: [header] } } } : {};
}
