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
import { OG_IMAGE_PNG_BASE64, OG_IMAGE_ES_PNG_BASE64 } from '../lib/og-image.mjs';
import { renderLanding } from '../lib/landing.mjs';
import { handleReport } from '../lib/report.mjs';

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
- [AI search (GEO) checker](https://web-intel-api.vercel.app/#check): checks whether ChatGPT, Perplexity and Google AI can read a website (/llms.txt, AI crawler rules in robots.txt, JSON-LD, meta tags, headings). No signup, 5 checks per day. Spanish version: https://web-intel-api.vercel.app/es

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


export async function handleApiRequest(reqUrl, method = 'GET', bodyObj = {}, headers = {}) {
  const parsed = new URL(reqUrl, 'http://localhost');
  const rewrittenPath = parsed.searchParams.get('__path');
  const rawPathname = rewrittenPath || parsed.pathname;
  const pathname = rawPathname.replace(/\/+$/, '') || '/';

  // Paid endpoints (/api/v1/*) are only reachable through the RapidAPI gateway.
  // Landing page, OpenAPI spec and health checks stay public.
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/es' ||
    pathname === '/og-es.png' ||
    pathname === '/api' ||
    pathname === '/api/index.mjs' ||
    pathname === '/openapi.json' ||
    pathname === '/mcp' ||
    pathname === '/informe' ||
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

  if (pathname === '/es') {
    return { status: 200, contentType: 'text/html; charset=utf-8', text: renderLanding('es') };
  }
  if (pathname === '/og-es.png') {
    return { status: 200, contentType: 'image/png', text: Buffer.from(OG_IMAGE_ES_PNG_BASE64, 'base64'), cache: 'public, max-age=86400' };
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
      text: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://web-intel-api.vercel.app/</loc></url><url><loc>https://web-intel-api.vercel.app/es</loc></url><url><loc>https://web-intel-api.vercel.app/llms.txt</loc></url></urlset>\n'
    };
  }

  // Remote MCP server for AI agents (each call forwarded to RapidAPI with the caller's key)
  // Private client report (protected by REPORT_KEY, see lib/report.mjs)
  if (pathname === '/informe') {
    return handleReport(method, bodyObj, headers);
  }

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
    return res.status(200).send(renderLanding('en'));
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
