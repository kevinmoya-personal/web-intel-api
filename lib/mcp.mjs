/**
 * Remote MCP server (Streamable HTTP, stateless, JSON responses).
 *
 * Exposes the 6 RapidAPI products as MCP tools so AI agents (Claude, Cursor, etc.)
 * can call them. Each tool call is forwarded to RapidAPI with the CALLER's own key,
 * so usage is metered and billed on their RapidAPI plan exactly like a direct call.
 *
 * Client config (key sent as a header):
 *   URL:    https://web-intel-api.vercel.app/mcp
 *   Header: x-rapidapi-key: <your RapidAPI key>      (or  Authorization: Bearer <key>)
 */

const SERVER_INFO = { name: 'web2agent-web-intel', title: 'Web2Agent Web Intelligence', version: '1.1.0' };
const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SIGNUP_URL = 'https://rapidapi.com/user/kevinmoyapersonal';

const HOSTS = {
  web2agent: 'web2agent-clean-markdown-seo-geo-auditor.p.rapidapi.com',
  email: 'disposable-email-mx-b2b-lead-validator.p.rapidapi.com',
  dns: 'dns-ssl-certificate-domain-security-recon.p.rapidapi.com',
  unfurl: 'serp-preview-social-card-link-unfurler.p.rapidapi.com',
  aiguard: 'ai-prompt-guard-pii-redactor-rag-chunker.p.rapidapi.com',
  headers: 'http-security-headers-owasp-compliance-auditor.p.rapidapi.com'
};

const urlArg = { url: { type: 'string', description: 'Public http(s) URL of the page, e.g. https://stripe.com' } };
const domainArg = { domain: { type: 'string', description: 'Domain name without protocol, e.g. stripe.com' } };

export const TOOLS = [
  {
    name: 'web_to_markdown', host: HOSTS.web2agent, path: '/api/v1/extract', args: ['url'],
    description: 'Fetch a public web page and return clean, LLM-ready Markdown (no nav, scripts or ads) with title, metadata and a token estimate. Static HTML only.',
    inputSchema: { type: 'object', properties: urlArg, required: ['url'] }
  },
  {
    name: 'geo_seo_audit', host: HOSTS.web2agent, path: '/api/v1/audit', args: ['url'],
    description: 'Audit a page for AI-search (GEO) and SEO readiness: /llms.txt, robots.txt rules for GPTBot/ClaudeBot/PerplexityBot/Google-Extended, JSON-LD, title/meta/canonical, H1, image alts. Returns a 0-100 score, grade and issues by severity.',
    inputSchema: { type: 'object', properties: urlArg, required: ['url'] }
  },
  {
    name: 'tech_stack_and_contacts', host: HOSTS.web2agent, path: '/api/v1/tech-stack', args: ['url'],
    description: 'Detect the technologies a website uses (CMS, frameworks, analytics, payments, CDN) and its public contact emails and social profiles.',
    inputSchema: { type: 'object', properties: urlArg, required: ['url'] }
  },
  {
    name: 'verify_email', host: HOSTS.email, path: '/api/v1/email-verify', args: ['email'],
    description: 'Validate an email address: syntax, MX records and mail provider, disposable/temporary domain, free vs business provider, role account (info@, sales@). Returns deliverable flag, verdict and 0-100 quality score. DNS-based, no SMTP check.',
    inputSchema: { type: 'object', properties: { email: { type: 'string', description: 'Email address to validate' } }, required: ['email'] }
  },
  {
    name: 'domain_security_recon', host: HOSTS.dns, path: '/api/v1/domain-recon', args: ['domain'],
    description: 'DNS records (A, AAAA, MX, NS, TXT), SPF and DMARC presence, TLS certificate issuer and days to expiry, and a 0-100 domain security score.',
    inputSchema: { type: 'object', properties: domainArg, required: ['domain'] }
  },
  {
    name: 'ssl_certificate_check', host: HOSTS.dns, path: '/api/v1/ssl-check', args: ['domain'],
    description: 'Check a domain\'s TLS certificate: validity, issuer, SANs, valid-from/to and days remaining.',
    inputSchema: { type: 'object', properties: domainArg, required: ['domain'] }
  },
  {
    name: 'unfurl_link', host: HOSTS.unfurl, path: '/api/v1/unfurl', args: ['url'],
    description: 'Unfurl a URL into title, description, preview image, favicon, site name, reading time and a Google SERP preview with length checks.',
    inputSchema: { type: 'object', properties: urlArg, required: ['url'] }
  },
  {
    name: 'prompt_guard_and_pii_redact', host: HOSTS.aiguard, path: '/api/v1/ai-guard', args: ['text', 'chunkSize'],
    description: 'Screen text before sending it to an LLM: flag prompt-injection/jailbreak patterns, redact PII (emails, phones, card numbers, API keys) and split it into token-sized RAG chunks. Pattern-based.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to screen and redact' },
        chunkSize: { type: 'integer', description: 'Target tokens per RAG chunk (default 250)' }
      },
      required: ['text']
    }
  },
  {
    name: 'security_headers_audit', host: HOSTS.headers, path: '/api/v1/security-headers', args: ['url'],
    description: 'Grade a website\'s HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CORS) from A+ to F with exact fixes.',
    inputSchema: { type: 'object', properties: urlArg, required: ['url'] }
  }
];

function readHeader(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find(k => k.toLowerCase() === name);
  const v = key ? headers[key] : undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function callerKey(headers) {
  const direct = readHeader(headers, 'x-rapidapi-key');
  if (direct) return String(direct).trim();
  const auth = readHeader(headers, 'authorization');
  const m = auth && String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const toolText = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

async function callTool(name, args = {}, headers, fetchImpl) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return toolText(`Unknown tool: ${name}`, true);

  const key = callerKey(headers);
  if (!key) {
    return toolText(
      `This tool needs your RapidAPI key. Subscribe to the API (a free plan is available) at ${SIGNUP_URL}, ` +
      'then add the header "x-rapidapi-key: <your key>" (or "Authorization: Bearer <your key>") to this MCP server in your client config.',
      true
    );
  }

  const params = new URLSearchParams();
  for (const a of tool.args) {
    if (args[a] !== undefined && args[a] !== null && args[a] !== '') params.set(a, String(args[a]));
  }
  const missing = tool.inputSchema.required.filter(r => !params.has(r));
  if (missing.length) return toolText(`Missing required argument(s): ${missing.join(', ')}`, true);

  let res;
  try {
    res = await fetchImpl(`https://${tool.host}${tool.path}?${params}`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': tool.host },
      signal: AbortSignal.timeout(25000)
    });
  } catch (err) {
    return toolText(`Request failed: ${err.message}`, true);
  }

  const raw = await res.text();
  if (res.status === 403 || res.status === 401) {
    return toolText(
      `RapidAPI rejected the key (HTTP ${res.status}). Make sure you are subscribed to this API: ${SIGNUP_URL}. Response: ${raw.slice(0, 300)}`,
      true
    );
  }
  if (res.status === 429) {
    return toolText(`Plan quota or rate limit reached on RapidAPI (HTTP 429). Upgrade or wait: ${SIGNUP_URL}`, true);
  }
  let pretty = raw;
  try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* keep raw */ }
  return toolText(pretty, !res.ok);
}

/**
 * Handles one MCP HTTP request. Returns { status, body, headers? }; body null = empty response.
 */
export async function handleMcp(method, body, headers = {}, fetchImpl = fetch) {
  if (method === 'GET') {
    return { status: 405, body: { error: 'This MCP server is stateless: use POST (Streamable HTTP, JSON responses).' }, headers: { Allow: 'POST' } };
  }
  if (method === 'DELETE') return { status: 405, body: null, headers: { Allow: 'POST' } };
  if (method !== 'POST') return { status: 405, body: null, headers: { Allow: 'POST' } };

  let msg = body;
  if (typeof msg === 'string') {
    try { msg = JSON.parse(msg); } catch { return { status: 400, body: rpcError(null, -32700, 'Parse error') }; }
  }
  if (Array.isArray(msg)) {
    return { status: 400, body: rpcError(null, -32600, 'Batch requests are not supported') };
  }
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return { status: 400, body: rpcError(msg?.id ?? null, -32600, 'Invalid Request') };
  }

  const { id, method: rpcMethod, params = {} } = msg;
  const isNotification = id === undefined || id === null;
  if (isNotification) return { status: 202, body: null };

  switch (rpcMethod) {
    case 'initialize': {
      const requested = params.protocolVersion;
      const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[1];
      return {
        status: 200,
        body: rpcResult(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            'Web intelligence tools: clean Markdown from URLs, AI-search (GEO)/SEO audits, tech stack detection, email validation, ' +
            'DNS/SSL recon, link unfurling, prompt-injection screening with PII redaction, and security-header grading. ' +
            `Requires a RapidAPI key sent as the x-rapidapi-key header (free plan: ${SIGNUP_URL}).`
        })
      };
    }
    case 'ping':
      return { status: 200, body: rpcResult(id, {}) };
    case 'tools/list':
      return {
        status: 200,
        body: rpcResult(id, {
          tools: TOOLS.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
            annotations: { readOnlyHint: true, openWorldHint: true }
          }))
        })
      };
    case 'tools/call':
      return { status: 200, body: rpcResult(id, await callTool(params.name, params.arguments || {}, headers, fetchImpl)) };
    case 'resources/list':
      return { status: 200, body: rpcResult(id, { resources: [] }) };
    case 'prompts/list':
      return { status: 200, body: rpcResult(id, { prompts: [] }) };
    default:
      return { status: 200, body: rpcError(id, -32601, `Method not found: ${rpcMethod}`) };
  }
}
