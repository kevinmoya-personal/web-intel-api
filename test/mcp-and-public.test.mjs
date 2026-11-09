import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp, TOOLS, callerKey } from '../lib/mcp.mjs';
import { takeFreeCheck, clientIp, FREE_CHECKS_PER_DAY, _resetFreeChecks } from '../lib/public-check.mjs';
import { handleApiRequest } from '../api/index.mjs';

const rpc = (method, params = {}, id = 1) => ({ jsonrpc: '2.0', id, method, params });

test('MCP initialize negotiates protocol version', async () => {
  const r = await handleMcp('POST', rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } }));
  assert.equal(r.status, 200);
  assert.equal(r.body.result.protocolVersion, '2025-06-18');
  assert.ok(r.body.result.capabilities.tools);
  const r2 = await handleMcp('POST', rpc('initialize', { protocolVersion: '1999-01-01' }));
  assert.equal(r2.body.result.protocolVersion, '2025-06-18');
});

test('MCP tools/list exposes all tools with schemas', async () => {
  const r = await handleMcp('POST', rpc('tools/list'));
  assert.equal(r.body.result.tools.length, TOOLS.length);
  for (const t of r.body.result.tools) {
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(t.description.length > 20);
  }
});

test('MCP notifications get 202 with empty body; GET is 405', async () => {
  const n = await handleMcp('POST', { jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(n.status, 202);
  assert.equal(n.body, null);
  assert.equal((await handleMcp('GET')).status, 405);
});

test('MCP invalid / unknown requests', async () => {
  assert.equal((await handleMcp('POST', 'not json')).body.error.code, -32700);
  assert.equal((await handleMcp('POST', { foo: 1 })).body.error.code, -32600);
  assert.equal((await handleMcp('POST', rpc('nope/method'))).body.error.code, -32601);
});

test('MCP tools/call without key returns a helpful tool error', async () => {
  const r = await handleMcp('POST', rpc('tools/call', { name: 'geo_seo_audit', arguments: { url: 'https://stripe.com' } }));
  assert.equal(r.body.result.isError, true);
  assert.match(r.body.result.content[0].text, /RapidAPI key/);
});

test('MCP tools/call forwards to RapidAPI with the caller key', async () => {
  let seen;
  const fakeFetch = async (url, opts) => {
    seen = { url, headers: opts.headers };
    return new Response(JSON.stringify({ success: true, verdict: 'deliverable' }), { status: 200 });
  };
  const r = await handleMcp('POST', rpc('tools/call', { name: 'verify_email', arguments: { email: 'ceo@acme.com' } }),
    { Authorization: 'Bearer key-123' }, fakeFetch);
  assert.equal(seen.url, 'https://disposable-email-mx-b2b-lead-validator.p.rapidapi.com/api/v1/email-verify?email=ceo%40acme.com');
  assert.equal(seen.headers['x-rapidapi-key'], 'key-123');
  assert.equal(seen.headers['x-rapidapi-host'], 'disposable-email-mx-b2b-lead-validator.p.rapidapi.com');
  assert.equal(r.body.result.isError, false);
  assert.match(r.body.result.content[0].text, /deliverable/);
});

test('MCP maps RapidAPI 403 and 429 to clear messages; missing args rejected', async () => {
  const f403 = async () => new Response('{"message":"You are not subscribed"}', { status: 403 });
  const r = await handleMcp('POST', rpc('tools/call', { name: 'unfurl_link', arguments: { url: 'https://a.com' } }), { 'x-rapidapi-key': 'k' }, f403);
  assert.match(r.body.result.content[0].text, /subscribed/);
  const f429 = async () => new Response('{}', { status: 429 });
  const r2 = await handleMcp('POST', rpc('tools/call', { name: 'unfurl_link', arguments: { url: 'https://a.com' } }), { 'x-rapidapi-key': 'k' }, f429);
  assert.match(r2.body.result.content[0].text, /quota/);
  const r3 = await handleMcp('POST', rpc('tools/call', { name: 'unfurl_link', arguments: {} }), { 'x-rapidapi-key': 'k' }, f429);
  assert.match(r3.body.result.content[0].text, /Missing required/);
});

test('callerKey reads x-rapidapi-key or Bearer token', () => {
  assert.equal(callerKey({ 'X-RapidAPI-Key': 'a' }), 'a');
  assert.equal(callerKey({ authorization: 'Bearer b' }), 'b');
  assert.equal(callerKey({}), '');
});

test('free check limiter: N per IP per day, resets next day', () => {
  _resetFreeChecks();
  for (let i = 0; i < FREE_CHECKS_PER_DAY; i++) assert.equal(takeFreeCheck('1.1.1.1', '2026-11-09').allowed, true);
  assert.equal(takeFreeCheck('1.1.1.1', '2026-11-09').allowed, false);
  assert.equal(takeFreeCheck('2.2.2.2', '2026-11-09').allowed, true);
  assert.equal(takeFreeCheck('1.1.1.1', '2026-11-10').allowed, true);
  assert.equal(clientIp({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }), '9.9.9.9');
});

test('public routes stay open in production; paid routes stay protected', async () => {
  const saved = { ...process.env };
  process.env.VERCEL = '1';
  process.env.RAPIDAPI_PROXY_SECRET_1 = 'sec';
  try {
    const mcp = await handleApiRequest('/api/index.mjs?__path=/mcp', 'POST', rpc('tools/list'), {});
    assert.equal(mcp.status, 200);
    const llms = await handleApiRequest('/llms.txt', 'GET', {}, {});
    assert.equal(llms.status, 200);
    assert.match(llms.text, /MCP server/);
    const missing = await handleApiRequest('/api/public/check', 'GET', {}, {});
    assert.equal(missing.status, 400);
    const paid = await handleApiRequest('/api/v1/audit?url=https://a.com', 'GET', {}, {});
    assert.equal(paid.status, 403);
  } finally {
    process.env = saved;
  }
});
