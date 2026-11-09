/**
 * Security helpers: RapidAPI proxy-secret authentication + SSRF protection.
 *
 * Authentication
 * --------------
 * Every RapidAPI project has its own "X-RapidAPI-Proxy-Secret" (Studio > Hub Listing >
 * Gateway). Because the 6 projects share this backend, all of their secrets must be
 * accepted. Configure them in Vercel as a comma-separated list:
 *
 *   RAPIDAPI_PROXY_SECRETS=secretWeb2Agent,secretHeaders,secretAiGuard,...
 *
 * The legacy single-value RAPIDAPI_PROXY_SECRET is still honoured.
 *
 * When running on Vercel (process.env.VERCEL === '1') with no secret configured, the
 * paid endpoints FAIL CLOSED (HTTP 503) so a missing variable can never expose the API
 * for free. Set ALLOW_UNAUTHENTICATED=true only for local demos.
 */

import { timingSafeEqual } from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

export function getConfiguredSecrets(env = process.env) {
  const raw = [env.RAPIDAPI_PROXY_SECRETS, env.RAPIDAPI_PROXY_SECRET].filter(Boolean).join(',');
  return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))];
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function readHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (direct !== undefined) return Array.isArray(direct) ? direct[0] : direct;
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

/**
 * Returns { ok: true } or { ok: false, status, error }.
 */
export function checkProxySecret(headers, env = process.env) {
  const secrets = getConfiguredSecrets(env);

  if (secrets.length === 0) {
    const onVercel = env.VERCEL === '1' || Boolean(env.VERCEL_ENV);
    if (onVercel && env.ALLOW_UNAUTHENTICATED !== 'true') {
      return {
        ok: false,
        status: 503,
        error: 'Service not configured: RAPIDAPI_PROXY_SECRETS is missing on the server.'
      };
    }
    return { ok: true };
  }

  const incoming = readHeader(headers, 'x-rapidapi-proxy-secret');
  if (incoming && secrets.some(s => safeEqual(s, incoming))) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    error: 'Forbidden: this API is only available through RapidAPI. Subscribe (free plan available) at https://rapidapi.com/user/kevinmoyapersonal'
  };
}

/* ------------------------------------------------------------------ */
/* SSRF protection                                                     */
/* ------------------------------------------------------------------ */

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
].map(([base, bits]) => [ipv4ToInt(base), bits]);

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4_RANGES.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (base & mask);
    });
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb') ||
      lower.startsWith('ff')
    );
  }
  return true; // unknown format: treat as unsafe
}

/**
 * Throws if the hostname is local/private or resolves to a private address.
 */
export async function assertPublicHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) throw new Error('Invalid URL: missing hostname.');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('Access to private or local network addresses is forbidden.');
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Access to private or local network addresses is forbidden.');
    return;
  }

  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve hostname: ${host}`);
  }
  if (!addresses.length || addresses.some(a => isPrivateIp(a.address))) {
    throw new Error('Access to private or local network addresses is forbidden.');
  }
}
