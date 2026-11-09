/**
 * Core Web Intelligence Engine
 * Zero external dependencies — runs natively on Node 20/24, Vercel Serverless, or Cloudflare Workers.
 * Provides:
 * 1. Clean HTML-to-Markdown extraction + token estimation for AI Agents
 * 2. Deep SEO + GEO (Generative Engine Optimization / AI-Readiness) Technical Audit
 * 3. B2B Lead Enrichment: Tech Stack Fingerprinting + Public Contact & Social Extraction
 */

import { assertPublicHost } from './security.mjs';

const USER_AGENT = 'Mozilla/5.0 (compatible; WebIntelBot/1.0; +https://rapidapi.com)';

/**
 * fetch() that validates every hop (initial URL + each redirect) against private networks.
 */
export async function safeFetch(url, options = {}, maxRedirects = 5) {
  let current = new URL(url);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new Error('Only http and https URLs are supported.');
    }
    await assertPublicHost(current.hostname);
    const response = await fetch(current.href, { ...options, redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel?.().catch(() => {});
      current = new URL(location, current);
      continue;
    }
    return { response, finalUrl: current.href };
  }
  throw new Error('Too many redirects.');
}

/**
 * Safely fetches a URL with timeout and timing measurement
 */
export async function fetchTargetPage(targetUrl, timeoutMs = 10000) {
  let parsedUrl;
  try {
    const raw = String(targetUrl || '').trim();
    parsedUrl = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error(`Invalid URL provided: ${targetUrl}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const { response, finalUrl } = await safeFetch(parsedUrl.href, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
      },
      signal: controller.signal
    });

    const html = await response.text();
    const responseTimeMs = Math.round(performance.now() - start);

    const headersObj = {};
    response.headers.forEach((v, k) => {
      headersObj[k.toLowerCase()] = v;
    });

    const final = new URL(finalUrl);
    return {
      requestedUrl: parsedUrl.href,
      finalUrl,
      origin: final.origin,
      hostname: final.hostname,
      status: response.status,
      responseTimeMs,
      headers: headersObj,
      html
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Decodes common HTML entities
 */
function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reads an HTML attribute value whether it is double-quoted, single-quoted or unquoted
 * (minified pages often use <html lang=en> or <meta name=description content=...>).
 */
function getAttr(attrs, name) {
  const rx = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\`]+))`, 'i');
  const m = String(attrs || '').match(rx);
  if (!m) return null;
  const v = m[1] ?? m[2] ?? m[3];
  return m[3] !== undefined ? v.replace(/\/$/, '') : v;
}

/**
 * Extracts metadata, headings, links, images, and JSON-LD from raw HTML
 */
export function parseHtmlMetadata(html, baseUrl) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]) : null;

  // Meta tags
  const metaTags = {};
  const metaRegex = /<meta\s+([^>]+)>/gi;
  let m;
  while ((m = metaRegex.exec(html)) !== null) {
    const attrs = m[1];
    const key = getAttr(attrs, 'name') || getAttr(attrs, 'property');
    const content = getAttr(attrs, 'content');
    if (key && content !== null) {
      metaTags[key.toLowerCase()] = decodeEntities(content);
    }
  }

  // Canonical URL
  let canonical = null;
  const linkTagRegex = /<link\s+([^>]+)>/gi;
  let lt;
  while ((lt = linkTagRegex.exec(html)) !== null) {
    const rel = (getAttr(lt[1], 'rel') || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) {
      canonical = getAttr(lt[1], 'href');
      break;
    }
  }

  // Headings H1-H3
  const headings = { h1: [], h2: [], h3: [] };
  for (const level of ['h1', 'h2', 'h3']) {
    const rx = new RegExp(`<${level}[^>]*>([\\s\\S]*?)<\\/${level}>`, 'gi');
    let hm;
    while ((hm = rx.exec(html)) !== null) {
      const text = decodeEntities(hm[1].replace(/<[^>]+>/g, ' '));
      if (text) headings[level].push(text);
    }
  }

  // JSON-LD Structured Data
  const jsonLd = [];
  const ldRegex = /<script\s+([^>]*)>([\s\S]*?)<\/script>/gi;
  let ldm;
  while ((ldm = ldRegex.exec(html)) !== null) {
    if ((getAttr(ldm[1], 'type') || '').toLowerCase() !== 'application/ld+json') continue;
    try {
      jsonLd.push(JSON.parse(ldm[2].trim()));
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // Images & alt attributes
  const imgRegex = /<img\s+([^>]+)>/gi;
  let totalImages = 0;
  let imagesMissingAlt = 0;
  let im;
  while ((im = imgRegex.exec(html)) !== null) {
    totalImages++;
    const alt = getAttr(im[1], 'alt');
    if (alt === null || alt.trim() === '') {
      imagesMissingAlt++;
    }
  }

  // Links (internal vs external)
  const linkRegex = /<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
  const internalLinks = new Set();
  const externalLinks = new Set();
  let lm;
  const baseHost = new URL(baseUrl).hostname;
  while ((lm = linkRegex.exec(html)) !== null) {
    const href = (getAttr(lm[1], 'href') || '').split('#')[0].trim();
    if (!href) continue;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname === baseHost) {
        internalLinks.add(resolved.href);
      } else {
        externalLinks.add(resolved.href);
      }
    } catch {
      // ignore invalid href
    }
  }

  return {
    title,
    description: metaTags['description'] || metaTags['og:description'] || null,
    canonical,
    language: getAttr((html.match(/<html\s+([^>]*)>/i) || [])[1], 'lang') || null,
    openGraph: {
      title: metaTags['og:title'] || null,
      description: metaTags['og:description'] || null,
      image: metaTags['og:image'] || null,
      type: metaTags['og:type'] || null,
      siteName: metaTags['og:site_name'] || null
    },
    twitterCard: {
      card: metaTags['twitter:card'] || null,
      title: metaTags['twitter:title'] || null,
      image: metaTags['twitter:image'] || null
    },
    robotsMeta: metaTags['robots'] || null,
    headings,
    jsonLdCount: jsonLd.length,
    jsonLdTypes: jsonLd.map(item => item['@type'] || 'Unknown').flat(),
    images: {
      total: totalImages,
      missingAlt: imagesMissingAlt
    },
    links: {
      internalCount: internalLinks.size,
      externalCount: externalLinks.size,
      sampleExternal: [...externalLinks].slice(0, 15)
    }
  };
}

/**
 * Converts HTML into clean, LLM-ready Markdown & estimates token count
 */
export function htmlToCleanMarkdown(html, title = '') {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Convert headings, links, bold, lists, paragraphs
  cleaned = cleaned
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n')
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n\n#### $1\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<[^>]+>/g, ' ');

  const lines = cleaned
    .split('\n')
    .map(line => decodeEntities(line))
    .filter(line => line.length > 0);

  const markdownBody = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  const fullMarkdown = title ? `# ${title}\n\n${markdownBody}` : markdownBody;
  const wordCount = fullMarkdown.split(/\s+/).filter(Boolean).length;
  const estimatedTokens = Math.ceil(fullMarkdown.length / 4);

  return {
    markdown: fullMarkdown.slice(0, 25000),
    wordCount,
    estimatedTokens,
    readingTimeMinutes: Math.max(1, Math.round(wordCount / 200))
  };
}

/**
 * Checks robots.txt and llms.txt for AI-Readiness (GEO Score)
 */
export async function checkAiReadiness(origin) {
  const result = {
    hasRobotsTxt: false,
    hasLlmsTxt: false,
    blocksAiBots: false,
    blockedBots: []
  };

  try {
    const [robotsRes, llmsRes] = await Promise.allSettled([
      safeFetch(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(4000) }).then(r => r.response),
      safeFetch(`${origin}/llms.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(4000) }).then(r => r.response)
    ]);

    if (robotsRes.status === 'fulfilled' && robotsRes.value.ok) {
      const txt = await robotsRes.value.text();
      if (txt.toLowerCase().includes('user-agent')) {
        result.hasRobotsTxt = true;
        const aiBots = ['gptbot', 'claudebot', 'perplexitybot', 'google-extended', 'ccbot'];
        for (const bot of aiBots) {
          const rx = new RegExp(`user-agent:\\s*${bot}[\\s\\S]*?disallow:\\s*\\/\\s*$`, 'im');
          if (rx.test(txt)) {
            result.blockedBots.push(bot);
          }
        }
        result.blocksAiBots = result.blockedBots.length > 0;
      }
    }

    if (llmsRes.status === 'fulfilled' && llmsRes.value.ok) {
      const txt = await llmsRes.value.text();
      if (txt.length > 20 && !txt.trim().toLowerCase().startsWith('<!doctype html')) {
        result.hasLlmsTxt = true;
      }
    }
  } catch {
    // ignore auxiliary timeouts
  }

  return result;
}

/**
 * Computes comprehensive SEO + GEO (AI Readiness) Audit Score & Actionable Recommendations
 */
export function computeAuditReport(pageData, meta, aiReadiness) {
  let score = 100;
  const issues = [];
  const passed = [];

  // 1. Title
  if (!meta.title) {
    score -= 15;
    issues.push({ severity: 'high', category: 'SEO', message: 'Missing <title> tag.' });
  } else if (meta.title.length < 15 || meta.title.length > 70) {
    score -= 5;
    issues.push({ severity: 'low', category: 'SEO', message: `Title length (${meta.title.length} chars) is outside optimal 15–70 chars range.` });
  } else {
    passed.push('Optimal <title> length');
  }

  // 2. Meta Description
  if (!meta.description) {
    score -= 15;
    issues.push({ severity: 'high', category: 'SEO', message: 'Missing meta description.' });
  } else if (meta.description.length < 50 || meta.description.length > 170) {
    score -= 5;
    issues.push({ severity: 'low', category: 'SEO', message: `Meta description length (${meta.description.length} chars) should be between 50 and 160 chars.` });
  } else {
    passed.push('Optimal meta description');
  }

  // 3. H1 Heading
  if (meta.headings.h1.length === 0) {
    score -= 12;
    issues.push({ severity: 'high', category: 'Structure', message: 'No <h1> heading found on the page.' });
  } else if (meta.headings.h1.length > 1) {
    score -= 4;
    issues.push({ severity: 'medium', category: 'Structure', message: `Multiple <h1> tags found (${meta.headings.h1.length}). Recommend using a single primary <h1>.` });
  } else {
    passed.push('Single clear <h1> heading present');
  }

  // 4. Canonical & OpenGraph
  if (!meta.canonical) {
    score -= 8;
    issues.push({ severity: 'medium', category: 'SEO', message: 'Missing rel="canonical" link tag.' });
  } else {
    passed.push('Canonical URL defined');
  }

  if (!meta.openGraph.title || !meta.openGraph.image) {
    score -= 6;
    issues.push({ severity: 'low', category: 'Social', message: 'Incomplete OpenGraph tags (og:title or og:image missing).' });
  } else {
    passed.push('Complete OpenGraph social tags');
  }

  // 5. Image Accessibility
  if (meta.images.missingAlt > 0) {
    const penalty = Math.min(10, meta.images.missingAlt * 2);
    score -= penalty;
    issues.push({ severity: 'medium', category: 'Accessibility', message: `${meta.images.missingAlt} of ${meta.images.total} images are missing alt attributes.` });
  } else if (meta.images.total > 0) {
    passed.push('All images include alt text');
  }

  // 6. AI-Readiness / GEO (Generative Engine Optimization)
  if (meta.jsonLdCount === 0) {
    score -= 10;
    issues.push({ severity: 'medium', category: 'AI-Readiness (GEO)', message: 'No JSON-LD (Schema.org) structured data found for LLMs and rich snippets.' });
  } else {
    passed.push(`JSON-LD structured data detected (${meta.jsonLdTypes.join(', ')})`);
  }

  if (!aiReadiness.hasLlmsTxt) {
    score -= 5;
    issues.push({ severity: 'low', category: 'AI-Readiness (GEO)', message: 'No /llms.txt file found to guide AI agents and LLM crawlers.' });
  } else {
    passed.push('/llms.txt file available for AI crawlers');
  }

  if (aiReadiness.blocksAiBots) {
    issues.push({ severity: 'info', category: 'AI-Readiness (GEO)', message: `robots.txt blocks AI crawlers: ${aiReadiness.blockedBots.join(', ')}` });
  }

  // 7. Security Headers
  const h = pageData.headers;
  if (!h['strict-transport-security']) {
    score -= 5;
    issues.push({ severity: 'low', category: 'Security', message: 'Missing Strict-Transport-Security (HSTS) header.' });
  } else {
    passed.push('HSTS security header active');
  }

  return {
    overallScore: Math.max(0, Math.min(100, score)),
    grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D',
    responseTimeMs: pageData.responseTimeMs,
    statusCode: pageData.status,
    issuesCount: issues.length,
    issues,
    passedChecks: passed,
    aiReadiness
  };
}

/**
 * Fingerprints technology stack & extracts public B2B contact signals (emails, social links)
 */
export function detectTechAndContacts(pageData) {
  const { html, headers } = pageData;
  const htmlLower = html.toLowerCase();
  const detectedTech = new Set();

  const signatures = [
    { name: 'Next.js', test: () => htmlLower.includes('/_next/') || headers['x-powered-by']?.includes('Next.js') },
    { name: 'Nuxt.js', test: () => htmlLower.includes('/_nuxt/') },
    { name: 'React', test: () => htmlLower.includes('react') || htmlLower.includes('data-reactroot') },
    { name: 'Vue.js', test: () => htmlLower.includes('data-v-') || htmlLower.includes('vue.global') },
    { name: 'Svelte / SvelteKit', test: () => htmlLower.includes('__sveltekit') || htmlLower.includes('svelte-') },
    { name: 'WordPress', test: () => htmlLower.includes('wp-content') || htmlLower.includes('wp-includes') },
    { name: 'Shopify', test: () => htmlLower.includes('cdn.shopify.com') || htmlLower.includes('Shopify.theme') },
    { name: 'Webflow', test: () => htmlLower.includes('data-wf-site') || htmlLower.includes('webflow.js') },
    { name: 'Wix', test: () => htmlLower.includes('wix.com') || htmlLower.includes('wixstatic.com') },
    { name: 'Tailwind CSS', test: () => /class=["'][^"']*(?:flex|grid|text-slate-|bg-indigo-|px-\d|py-\d)/.test(html) },
    { name: 'Bootstrap', test: () => htmlLower.includes('bootstrap.min.css') || htmlLower.includes('bootstrap.bundle') },
    { name: 'Google Tag Manager', test: () => htmlLower.includes('googletagmanager.com/gtm.js') },
    { name: 'Google Analytics (GA4)', test: () => htmlLower.includes('googletagmanager.com/gtag/js') || htmlLower.includes('google-analytics.com') },
    { name: 'Meta Pixel', test: () => htmlLower.includes('connect.facebook.net') && htmlLower.includes('fbevents.js') },
    { name: 'Stripe', test: () => htmlLower.includes('js.stripe.com') },
    { name: 'Intercom', test: () => htmlLower.includes('widget.intercom.io') },
    { name: 'HubSpot', test: () => htmlLower.includes('js.hs-scripts.com') || htmlLower.includes('hsforms.net') },
    { name: 'Cloudflare', test: () => Boolean(headers['cf-ray'] || headers['server']?.toLowerCase().includes('cloudflare')) },
    { name: 'Vercel', test: () => Boolean(headers['x-vercel-id'] || headers['server']?.toLowerCase().includes('vercel')) },
    { name: 'Netlify', test: () => Boolean(headers['x-nf-request-id'] || headers['server']?.toLowerCase().includes('netlify')) }
  ];

  for (const sig of signatures) {
    try {
      if (sig.test()) detectedTech.add(sig.name);
    } catch {
      // ignore
    }
  }

  // Extract public emails
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}\b/g;
  const rawEmails = html.match(emailRegex) || [];
  const cleanEmails = [...new Set(
    rawEmails
      .map(e => e.toLowerCase())
      .filter(e => !/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2)$/i.test(e) && !e.includes('example.com') && !e.includes('sentry.io'))
  )].slice(0, 10);

  // Extract social profiles
  const socialPatterns = {
    linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/gi,
    twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/gi,
    github: /https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/gi,
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi,
    youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|[a-zA-Z0-9_-]+)/gi
  };

  const socials = {};
  for (const [network, rx] of Object.entries(socialPatterns)) {
    const matches = html.match(rx);
    if (matches && matches.length > 0) {
      socials[network] = [...new Set(matches)].slice(0, 3);
    }
  }

  return {
    technologies: [...detectedTech],
    serverHeader: headers['server'] || null,
    poweredBy: headers['x-powered-by'] || null,
    contacts: {
      emails: cleanEmails,
      socialProfiles: socials
    }
  };
}
