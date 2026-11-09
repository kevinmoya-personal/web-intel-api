import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkProxySecret, getConfiguredSecrets, isPrivateIp, assertPublicHost } from '../lib/security.mjs';
import { handleApiRequest } from '../api/index.mjs';

const ENV_KEYS = ['RAPIDAPI_PROXY_SECRETS', 'RAPIDAPI_PROXY_SECRET', 'VERCEL', 'VERCEL_ENV', 'ALLOW_UNAUTHENTICATED'];
function withEnv(vars, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  return Promise.resolve(fn()).finally(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

test('parses multiple secrets and legacy single secret', () => {
  assert.deepEqual(
    getConfiguredSecrets({ RAPIDAPI_PROXY_SECRETS: ' a , b,,c ', RAPIDAPI_PROXY_SECRET: 'd' }),
    ['a', 'b', 'c', 'd']
  );
});

test('accepts any configured secret, rejects missing or wrong one', () => {
  const env = { RAPIDAPI_PROXY_SECRETS: 'alpha,beta' };
  assert.equal(checkProxySecret({ 'x-rapidapi-proxy-secret': 'beta' }, env).ok, true);
  assert.equal(checkProxySecret({ 'X-RapidAPI-Proxy-Secret': 'alpha' }, env).ok, true);
  assert.equal(checkProxySecret({ 'x-rapidapi-proxy-secret': 'nope' }, env).status, 403);
  assert.equal(checkProxySecret({}, env).status, 403);
});

test('fails closed on Vercel when no secret is configured', () => {
  assert.equal(checkProxySecret({}, { VERCEL: '1' }).status, 503);
  assert.equal(checkProxySecret({}, { VERCEL: '1', ALLOW_UNAUTHENTICATED: 'true' }).ok, true);
  assert.equal(checkProxySecret({}, {}).ok, true); // local dev
});

test('paid endpoint returns 403 without secret, public routes stay open', () =>
  withEnv({ RAPIDAPI_PROXY_SECRETS: 'secret-1,secret-2', VERCEL: '1' }, async () => {
    const blocked = await handleApiRequest('/api/v1/ai-guard?text=hello', 'GET', {}, {});
    assert.equal(blocked.status, 403);

    const ok = await handleApiRequest('/api/v1/ai-guard?text=mail+me+at+a@b.com', 'GET', {}, {
      'x-rapidapi-proxy-secret': 'secret-2'
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.success, true);

    assert.equal((await handleApiRequest('/openapi.json', 'GET', {}, {})).status, 200);
    assert.equal((await handleApiRequest('/', 'GET', {}, {})).status, 200);
    assert.equal((await handleApiRequest('/api/v1/health', 'GET', {}, {})).status, 200);
  }));

test('vercel rewrite path (?__path=) is also protected', () =>
  withEnv({ RAPIDAPI_PROXY_SECRETS: 's', VERCEL: '1' }, async () => {
    const r = await handleApiRequest('/api/index.mjs?__path=/api/v1/extract&url=https://example.com', 'GET', {}, {});
    assert.equal(r.status, 403);
  }));

test('detects private and reserved IPs', () => {
  for (const ip of ['127.0.0.1', '127.8.8.8', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('assertPublicHost blocks local hostnames and literal private IPs', async () => {
  for (const host of ['localhost', 'foo.localhost', '127.0.0.2', '[::1]', '172.20.0.5', 'metadata.internal']) {
    await assert.rejects(assertPublicHost(host), /forbidden/, host);
  }
});
