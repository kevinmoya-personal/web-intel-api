/**
 * Serverless API Handler (Compatible with Vercel Functions & Node.js HTTP)
 * Endpoints:
 * - GET / (Interactive SaaS Landing Page + Live Playground when viewed in browser)
 * - GET /openapi.json (Public OpenAPI 3.0 Spec for RapidAPI URL Import)
 * - GET/POST /api/v1/extract?url=https://...
 * - GET/POST /api/v1/audit?url=https://...
 * - GET/POST /api/v1/tech-stack?url=https://...
 * - GET/POST /api/v1/full-report?url=https://...
 */

import {
  fetchTargetPage,
  parseHtmlMetadata,
  htmlToCleanMarkdown,
  checkAiReadiness,
  computeAuditReport,
  detectTechAndContacts
} from '../lib/analyzer.mjs';
import {
  validateEmailAndDomain,
  runDomainRecon,
  inspectSslCertificate,
  unfurlLink,
  analyzeAndRedactText,
  auditHttpSecurityHeaders
} from '../lib/catalog-apis.mjs';
import { checkProxySecret, assertPublicHost } from '../lib/security.mjs';
import { runPublicCheck } from '../lib/public-check.mjs';
import { handleMcp } from '../lib/mcp.mjs';
import { OG_IMAGE_PNG_BASE64 } from '../lib/og-image.mjs';

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Web2Agent & SEO/GEO Intelligence API',
    version: '1.1.0',
    description: 'Convert any URL into clean LLM-ready Markdown, run instant SEO & AI-Readiness (GEO / llms.txt / JSON-LD) technical audits, and enrich B2B domains with technology stack fingerprinting and public contacts.'
  },
  servers: [{ url: 'https://web-intel-api.vercel.app' }],
  paths: {
    '/api/v1/extract': {
      get: {
        summary: 'Extract Clean LLM Markdown & Metadata from URL',
        parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string', example: 'https://example.com' } }],
        responses: { '200': { description: 'Successful extraction' } }
      }
    },
    '/api/v1/audit': {
      get: {
        summary: 'Run Technical SEO & AI-Readiness (GEO) Audit',
        parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string', example: 'https://example.com' } }],
        responses: { '200': { description: 'Audit score (0-100) and actionable issues' } }
      }
    },
    '/api/v1/tech-stack': {
      get: {
        summary: 'Detect Website Tech Stack & Public B2B Contacts',
        parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string', example: 'https://example.com' } }],
        responses: { '200': { description: 'Detected technologies and contact signals' } }
      }
    },
    '/api/v1/full-report': {
      get: {
        summary: 'All-in-One Extraction, SEO/GEO Audit & Tech Stack Report',
        parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string', example: 'https://example.com' } }],
        responses: { '200': { description: 'Complete intelligence report' } }
      }
    }
  }
};

const LLMS_TXT = `# Web2Agent Web Intelligence

> Free AI-search (GEO) checker plus 6 web-intelligence APIs and a remote MCP server for AI agents.

## Free tool
- [AI search (GEO) checker](https://web-intel-api.vercel.app/#check): checks whether ChatGPT, Perplexity and Google AI can read a website (/llms.txt, AI crawler rules in robots.txt, JSON-LD, meta tags, headings). No signup, 5 checks per day.

## APIs (RapidAPI, free plan available)
- [Web2Agent Clean Markdown & SEO GEO Auditor](https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor): URL to clean LLM Markdown, GEO/SEO audit, tech stack.
- [HTTP Security Headers & OWASP Compliance Auditor](https://rapidapi.com/kevinmoyapersonal/api/http-security-headers-owasp-compliance-auditor)
- [AI Prompt Guard, PII Redactor & RAG Chunker](https://rapidapi.com/kevinmoyapersonal/api/ai-prompt-guard-pii-redactor-rag-chunker)
- [SERP Preview, Social Card & Link Unfurler](https://rapidapi.com/kevinmoyapersonal/api/serp-preview-social-card-link-unfurler)
- [DNS, SSL Certificate & Domain Security Recon](https://rapidapi.com/kevinmoyapersonal/api/dns-ssl-certificate-domain-security-recon)
- [Disposable Email, MX & B2B Lead Validator](https://rapidapi.com/kevinmoyapersonal/api/disposable-email-mx-b2b-lead-validator)

## For AI agents
- MCP server (Streamable HTTP): https://web-intel-api.vercel.app/mcp with header x-rapidapi-key
- [OpenAPI spec](https://web-intel-api.vercel.app/openapi.json)
- [n8n templates and source](https://github.com/kevinmoya-personal/web-intel-api)
`;

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Free AI Search (GEO) Checker – Can ChatGPT read your site?</title>
  <meta name="description" content="Free check: can ChatGPT, Perplexity and Google AI read your website? Audits /llms.txt, AI crawlers, structured data and meta tags. No signup." />
  <link rel="canonical" href="https://web-intel-api.vercel.app/" />
  <meta property="og:title" content="Can ChatGPT read your website? Free AI-search (GEO) checker" />
  <meta property="og:description" content="Score 0–100 with the exact issues blocking AI search engines. No signup." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://web-intel-api.vercel.app/" />
  <meta property="og:image" content="https://web-intel-api.vercel.app/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Can ChatGPT read your website? Free AI-search (GEO) checker" />
  <meta name="twitter:image" content="https://web-intel-api.vercel.app/og.png" />
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"Web2Agent AI Search (GEO) Checker","url":"https://web-intel-api.vercel.app/","applicationCategory":"DeveloperApplication","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"Checks whether AI search engines like ChatGPT, Perplexity and Google AI can read and understand a website."}</script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans">
  <div class="max-w-5xl mx-auto px-6 py-12">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-4">
      ⚡ Production API Online • Ultra-Low Latency
    </div>
    <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
      Web2Agent & SEO/GEO Intelligence API
    </h1>
    <p class="text-slate-400 text-lg max-w-2xl mb-6">
      Turn any URL into clean LLM-ready Markdown, audit Technical SEO + AI-Readiness (<code class="text-emerald-300">/llms.txt</code> & Schema.org), and fingerprint B2B Tech Stacks in milliseconds.
    </p>

    <div class="flex flex-wrap gap-4 mb-10">
      <a href="https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor" target="_blank" rel="noopener" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-lg text-sm transition shadow-lg shadow-blue-600/25">
        🚀 Subscribe on RapidAPI Hub (Free / Pro / Ultra)
      </a>
      <a href="/openapi.json" target="_blank" class="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium px-5 py-3 rounded-lg text-sm transition">
        📄 OpenAPI 3.0 Spec
      </a>
    </div>

    <div id="check" class="bg-slate-900 border border-emerald-500/40 rounded-xl p-6 mb-10 shadow-xl">
      <h2 class="text-xl font-bold mb-1">Can ChatGPT, Perplexity &amp; Google AI read your website?</h2>
      <p class="text-sm text-slate-400 mb-4">Free AI-search (GEO) check — no signup. Checks /llms.txt, AI crawler blocking in robots.txt, structured data, meta tags and headings.</p>
      <form id="checkForm" class="flex flex-col sm:flex-row gap-3">
        <input id="checkUrl" type="text" inputmode="url" required placeholder="https://yourwebsite.com" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-emerald-500" />
        <button id="checkBtn" type="submit" class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-lg text-sm">Check my site</button>
      </form>
      <div id="checkOut" class="mt-5 hidden"></div>
      <p class="text-xs text-slate-500 mt-3">5 free checks per day. Full report, bulk audits and API access via RapidAPI (free plan available).</p>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-10 shadow-xl">
      <h2 class="text-lg font-semibold mb-2">🔑 Try it free on RapidAPI</h2>
      <p class="text-sm text-slate-400 mb-4">All endpoints are served exclusively through RapidAPI. The BASIC plan is free (50 requests/month, no credit card) and gives you an API key plus an in-browser playground with code snippets in 20+ languages.</p>
      <pre class="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-emerald-300 overflow-x-auto">curl --request GET \\
  --url 'https://web2agent-clean-markdown-seo-geo-auditor.p.rapidapi.com/api/v1/audit?url=https%3A%2F%2Fstripe.com' \\
  --header 'x-rapidapi-host: web2agent-clean-markdown-seo-geo-auditor.p.rapidapi.com' \\
  --header 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'</pre>
    </div>

    <div class="grid md:grid-cols-3 gap-6">
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 class="font-bold text-white mb-1">1. Clean LLM Markdown</h3>
        <p class="text-xs text-slate-400 mb-3">Strips ads, scripts & navbars. Returns clean Markdown + exact token estimate for AI agents.</p>
        <code class="text-xs text-emerald-400">GET /api/v1/extract?url=...</code>
      </div>
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 class="font-bold text-white mb-1">2. SEO & AI GEO Audit</h3>
        <p class="text-xs text-slate-400 mb-3">0–100 score checking meta tags, H1 hierarchy, JSON-LD, /llms.txt, and AI bot blocking.</p>
        <code class="text-xs text-emerald-400">GET /api/v1/audit?url=...</code>
      </div>
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 class="font-bold text-white mb-1">3. B2B Tech & Contacts</h3>
        <p class="text-xs text-slate-400 mb-3">Detects frameworks, CMS, analytics, Stripe/HubSpot, emails, and social links.</p>
        <code class="text-xs text-emerald-400">GET /api/v1/tech-stack?url=...</code>
      </div>
    </div>

    <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-10 shadow-xl">
      <h2 class="text-lg font-semibold mb-2">🤖 Use it from AI agents (MCP server)</h2>
      <p class="text-sm text-slate-400 mb-4">Add all 9 tools (web-to-Markdown, GEO audit, tech stack, email validation, DNS/SSL, link unfurl, prompt guard &amp; PII redaction, security headers) to Claude, Cursor or any MCP client. Uses your RapidAPI key, so the free plan works.</p>
      <pre class="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-emerald-300 overflow-x-auto">{
  "mcpServers": {
    "web2agent": {
      "type": "http",
      "url": "https://web-intel-api.vercel.app/mcp",
      "headers": { "x-rapidapi-key": "YOUR_RAPIDAPI_KEY" }
    }
  }
}</pre>
    </div>
  </div>
  <script>
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const sevColor = { high: 'text-red-400', medium: 'text-amber-400', low: 'text-sky-400', info: 'text-slate-400' };
    document.getElementById('checkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = document.getElementById('checkOut');
      const btn = document.getElementById('checkBtn');
      const url = document.getElementById('checkUrl').value.trim();
      if (!url) return;
      btn.disabled = true; btn.textContent = 'Checking…';
      out.classList.remove('hidden');
      out.innerHTML = '<p class="text-sm text-slate-400">Analyzing ' + esc(url) + '…</p>';
      try {
        const r = await fetch('/api/public/check?url=' + encodeURIComponent(url));
        const d = await r.json();
        if (!d.success) {
          out.innerHTML = '<p class="text-sm text-red-400">' + esc(d.error || 'Could not analyze that URL.') + '</p>' +
            (d.upgradeUrl ? '<a class="text-sm text-emerald-400 underline" target="_blank" rel="noopener" href="' + esc(d.upgradeUrl) + '">Get more checks on RapidAPI →</a>' : '');
          return;
        }
        const color = d.score >= 75 ? 'text-emerald-400' : d.score >= 60 ? 'text-amber-400' : 'text-red-400';
        const bots = d.aiReadiness.blocksAiBots ? 'Blocks: ' + esc(d.aiReadiness.blockedBots.join(', ')) : 'Not blocked';
        out.innerHTML =
          '<div class="flex items-baseline gap-4 mb-4"><span class="text-5xl font-extrabold ' + color + '">' + d.score + '</span>' +
          '<span class="text-slate-400">/ 100 · grade <b class="text-white">' + esc(d.grade) + '</b> · ' + d.issuesCount + ' issues</span></div>' +
          '<div class="grid sm:grid-cols-2 gap-3 mb-4 text-sm">' +
          '<div class="bg-slate-950 rounded-lg p-3">/llms.txt: <b>' + (d.aiReadiness.hasLlmsTxt ? 'found' : 'missing') + '</b></div>' +
          '<div class="bg-slate-950 rounded-lg p-3">AI crawlers in robots.txt: <b>' + bots + '</b></div></div>' +
          '<ul class="space-y-2 mb-4">' + d.topIssues.map(i =>
            '<li class="text-sm"><span class="uppercase text-xs font-bold ' + (sevColor[i.severity] || '') + '">' + esc(i.severity) + '</span> ' +
            '<span class="text-slate-400">' + esc(i.category) + ':</span> ' + esc(i.message) + '</li>').join('') + '</ul>' +
          (d.hiddenIssues > 0 ? '<p class="text-sm text-slate-300 mb-2">+ ' + d.hiddenIssues + ' more issues in the full report.</p>' : '') +
          '<a class="inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-lg" target="_blank" rel="noopener" href="' + esc(d.fullReportUrl) + '">Get the full report &amp; API access (free plan) →</a>' +
          '<p class="text-xs text-slate-500 mt-3">' + d.freeChecksRemainingToday + ' free checks left today.</p>';
      } catch (err) {
        out.innerHTML = '<p class="text-sm text-red-400">Network error. Please try again.</p>';
      } finally {
        btn.disabled = false; btn.textContent = 'Check my site';
      }
    });
  </script>
</body>
</html>`;

export async function handleApiRequest(reqUrl, method = 'GET', bodyObj = {}, headers = {}) {
  const parsed = new URL(reqUrl, 'http://localhost');
  const rewrittenPath = parsed.searchParams.get('__path');
  const rawPathname = rewrittenPath || parsed.pathname;
  const pathname = rawPathname.replace(/\/+$/, '') || '/';

  // Paid endpoints (/api/v1/*) are only reachable through the RapidAPI gateway.
  // Landing page, OpenAPI spec and health checks stay public.
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/api' ||
    pathname === '/api/index.mjs' ||
    pathname === '/openapi.json' ||
    pathname === '/mcp' ||
    pathname === '/llms.txt' ||
    pathname === '/og.png' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/api/public/check' ||
    pathname.endsWith('/health') ||
    pathname.endsWith('/ping');

  if (!isPublicRoute) {
    const auth = checkProxySecret(headers);
    if (!auth.ok) {
      return { status: auth.status, body: { success: false, error: auth.error } };
    }
  }

  if (pathname === '/og.png') {
    return { status: 200, contentType: 'image/png', text: Buffer.from(OG_IMAGE_PNG_BASE64, 'base64'), cache: 'public, max-age=86400' };
  }
  if (pathname === '/llms.txt') {
    return { status: 200, text: LLMS_TXT, contentType: 'text/plain; charset=utf-8' };
  }
  if (pathname === '/robots.txt') {
    return {
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      text: 'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://web-intel-api.vercel.app/sitemap.xml\n'
    };
  }
  if (pathname === '/sitemap.xml') {
    return {
      status: 200,
      contentType: 'application/xml; charset=utf-8',
      text: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://web-intel-api.vercel.app/</loc></url><url><loc>https://web-intel-api.vercel.app/llms.txt</loc></url></urlset>\n'
    };
  }

  // Remote MCP server for AI agents (each call forwarded to RapidAPI with the caller's key)
  if (pathname === '/mcp') {
    return handleMcp(method, bodyObj, headers);
  }

  // Free, rate-limited summary check used by the landing page (no signup)
  if (pathname === '/api/public/check') {
    try {
      return await runPublicCheck(parsed.searchParams.get('url') || bodyObj?.url, headers);
    } catch (err) {
      return { status: 502, body: { success: false, error: err.message || 'Could not analyze that URL.' } };
    }
  }

  if (pathname === '/openapi.json') {
    return {
      status: 200,
      body: OPENAPI_SPEC
    };
  }

  if (
    pathname === '/' ||
    pathname === '/api' ||
    pathname === '/api/index.mjs' ||
    pathname.endsWith('/health') ||
    pathname.endsWith('/ping')
  ) {
    return {
      status: 200,
      isLandingCandidate: pathname === '/' || pathname === '/api/index.mjs',
      body: {
        success: true,
        service: 'Web2Agent & SEO/GEO Intelligence API',
        version: '1.1.0',
        openapiSpecUrl: 'https://web-intel-api.vercel.app/openapi.json',
        endpoints: [
          '/api/v1/extract?url=https://example.com',
          '/api/v1/audit?url=https://example.com',
          '/api/v1/tech-stack?url=https://example.com',
          '/api/v1/full-report?url=https://example.com',
          '/api/v1/email-verify?email=contact@stripe.com',
          '/api/v1/domain-recon?domain=stripe.com',
          '/api/v1/ssl-check?domain=stripe.com',
          '/api/v1/unfurl?url=https://stripe.com',
          '/api/v1/ai-guard?text=Contact+john@acme.com+or+call+555-123-4567',
          '/api/v1/security-headers?url=https://stripe.com'
        ]
      }
    };
  }

  try {
    // API #2: Disposable Email, MX & B2B Lead Validator
    if (pathname.endsWith('/email-verify')) {
      const email = parsed.searchParams.get('email') || bodyObj?.email;
      if (!email) {
        return {
          status: 400,
          body: { success: false, error: 'Missing required "email" parameter (e.g. ?email=contact@stripe.com).' }
        };
      }
      const report = await validateEmailAndDomain(email);
      return { status: 200, body: { success: true, ...report } };
    }

    // API #3: DNS, SSL Certificate & Domain Security Recon
    if (pathname.endsWith('/domain-recon') || pathname.endsWith('/ssl-check')) {
      const domain = parsed.searchParams.get('domain') || parsed.searchParams.get('url') || bodyObj?.domain || bodyObj?.url;
      if (!domain) {
        return {
          status: 400,
          body: { success: false, error: 'Missing required "domain" parameter (e.g. ?domain=stripe.com).' }
        };
      }
      if (pathname.endsWith('/ssl-check')) {
        const cleanHost = String(domain).replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '');
        await assertPublicHost(cleanHost);
        const ssl = await inspectSslCertificate(cleanHost);
        return { status: 200, body: { success: true, domain: cleanHost, ssl } };
      }
      const recon = await runDomainRecon(domain);
      return { status: 200, body: { success: true, ...recon } };
    }

    // API #4: SERP Preview, Social Card & Link Unfurler
    if (pathname.endsWith('/unfurl')) {
      const url = parsed.searchParams.get('url') || bodyObj?.url;
      if (!url) {
        return {
          status: 400,
          body: { success: false, error: 'Missing required "url" parameter (e.g. ?url=https://stripe.com).' }
        };
      }
      const data = await unfurlLink(url);
      return { status: 200, body: { success: true, ...data } };
    }

    // API #5: AI Prompt Security, PII Redactor & RAG Chunker
    if (pathname.endsWith('/ai-guard') || pathname.endsWith('/pii-redact')) {
      const text = parsed.searchParams.get('text') || bodyObj?.text;
      const chunkSize = Number(parsed.searchParams.get('chunkSize') || bodyObj?.chunkSize || 250);
      if (!text) {
        return {
          status: 400,
          body: { success: false, error: 'Missing required "text" parameter (e.g. ?text=Reach+me+at+ceo@company.com).' }
        };
      }
      const analysis = analyzeAndRedactText(text, chunkSize);
      return { status: 200, body: { success: true, ...analysis } };
    }

    // API #6: HTTP Security Headers & OWASP Compliance Auditor
    if (pathname.endsWith('/security-headers')) {
      const url = parsed.searchParams.get('url') || bodyObj?.url;
      if (!url) {
        return {
          status: 400,
          body: { success: false, error: 'Missing required "url" parameter (e.g. ?url=https://stripe.com).' }
        };
      }
      const sec = await auditHttpSecurityHeaders(url);
      return { status: 200, body: { success: true, ...sec } };
    }

    const targetUrl = parsed.searchParams.get('url') || bodyObj?.url;
    if (!targetUrl) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Missing required "url" query parameter or JSON body property (e.g. ?url=https://stripe.com).'
        }
      };
    }

    const pageData = await fetchTargetPage(targetUrl);

    if (pathname.endsWith('/extract')) {
      const meta = parseHtmlMetadata(pageData.html, pageData.finalUrl);
      const content = htmlToCleanMarkdown(pageData.html, meta.title);
      return {
        status: 200,
        body: {
          success: true,
          url: pageData.finalUrl,
          statusCode: pageData.status,
          responseTimeMs: pageData.responseTimeMs,
          metadata: {
            title: meta.title,
            description: meta.description,
            language: meta.language,
            canonical: meta.canonical,
            openGraph: meta.openGraph
          },
          content
        }
      };
    }

    if (pathname.endsWith('/audit')) {
      const meta = parseHtmlMetadata(pageData.html, pageData.finalUrl);
      const aiReadiness = await checkAiReadiness(pageData.origin);
      const audit = computeAuditReport(pageData, meta, aiReadiness);
      return {
        status: 200,
        body: {
          success: true,
          url: pageData.finalUrl,
          audit,
          metadataSummary: {
            title: meta.title,
            description: meta.description,
            h1Count: meta.headings.h1.length,
            h2Count: meta.headings.h2.length,
            imagesTotal: meta.images.total,
            imagesMissingAlt: meta.images.missingAlt,
            internalLinks: meta.links.internalCount,
            externalLinks: meta.links.externalCount
          }
        }
      };
    }

    if (pathname.endsWith('/tech-stack')) {
      const enrichment = detectTechAndContacts(pageData);
      const meta = parseHtmlMetadata(pageData.html, pageData.finalUrl);
      return {
        status: 200,
        body: {
          success: true,
          url: pageData.finalUrl,
          hostname: pageData.hostname,
          companyMeta: {
            title: meta.title,
            description: meta.description,
            siteName: meta.openGraph.siteName
          },
          ...enrichment
        }
      };
    }

    if (pathname.endsWith('/full-report')) {
      const meta = parseHtmlMetadata(pageData.html, pageData.finalUrl);
      const [aiReadiness, content, enrichment] = await Promise.all([
        checkAiReadiness(pageData.origin),
        Promise.resolve(htmlToCleanMarkdown(pageData.html, meta.title)),
        Promise.resolve(detectTechAndContacts(pageData))
      ]);
      const audit = computeAuditReport(pageData, meta, aiReadiness);

      return {
        status: 200,
        body: {
          success: true,
          url: pageData.finalUrl,
          audit,
          enrichment,
          metadata: meta,
          content
        }
      };
    }

    return {
      status: 404,
      body: {
        success: false,
        error: `Unknown endpoint "${pathname}". Valid endpoints: /api/v1/extract, /api/v1/audit, /api/v1/tech-stack, /api/v1/full-report, /api/v1/email-verify, /api/v1/domain-recon, /api/v1/ssl-check, /api/v1/unfurl, /api/v1/ai-guard, /api/v1/security-headers`
      }
    };
  } catch (err) {
    return {
      status: 502,
      body: {
        success: false,
        error: err.message || 'Failed to fetch or analyze target URL.'
      }
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-RapidAPI-Key, X-RapidAPI-Host, X-RapidAPI-Proxy-Secret, Mcp-Protocol-Version, Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const result = await handleApiRequest(req.url, req.method, req.body || {}, req.headers || {});
  const acceptHeader = (req.headers?.['accept'] || '').toLowerCase();
  if (result.isLandingCandidate && acceptHeader.includes('text/html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(LANDING_HTML);
  }

  if (result.text !== undefined) {
    res.setHeader('Content-Type', result.contentType || 'text/plain; charset=utf-8');
    if (result.cache) res.setHeader('Cache-Control', result.cache);
    return res.status(result.status).send(result.text);
  }
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  }
  if (result.body === null || result.body === undefined) {
    return res.status(result.status).end();
  }
  res.status(result.status).json(result.body);
}
