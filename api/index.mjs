/**
 * Serverless API Handler (Compatible with Vercel Functions & Node.js HTTP)
 * Endpoints:
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

export async function handleApiRequest(reqUrl, method = 'GET', bodyObj = {}, headers = {}) {
  // Optional RapidAPI Proxy Secret protection (if RAPIDAPI_PROXY_SECRET env var is set in Vercel)
  const expectedSecret = process.env.RAPIDAPI_PROXY_SECRET;
  if (expectedSecret) {
    const incomingSecret = headers['x-rapidapi-proxy-secret'];
    if (incomingSecret !== expectedSecret) {
      return {
        status: 403,
        body: {
          success: false,
          error: 'Unauthorized: Missing or invalid X-RapidAPI-Proxy-Secret header.'
        }
      };
    }
  }

  const parsed = new URL(reqUrl, 'http://localhost');
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/' || pathname === '/api' || pathname === '/api/v1/health') {
    return {
      status: 200,
      body: {
        success: true,
        service: 'Web2Agent & SEO/GEO Intelligence API',
        version: '1.0.0',
        endpoints: [
          '/api/v1/extract?url=https://example.com',
          '/api/v1/audit?url=https://example.com',
          '/api/v1/tech-stack?url=https://example.com',
          '/api/v1/full-report?url=https://example.com'
        ]
      }
    };
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

  try {
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
        error: `Unknown endpoint "${pathname}". Valid endpoints: /api/v1/extract, /api/v1/audit, /api/v1/tech-stack, /api/v1/full-report`
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

// Default export for Vercel Serverless Functions
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RapidAPI-Key, X-RapidAPI-Host, X-RapidAPI-Proxy-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const result = await handleApiRequest(req.url, req.method, req.body || {}, req.headers || {});
  res.status(result.status).json(result.body);
}
