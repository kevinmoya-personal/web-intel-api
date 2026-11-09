/**
 * Free, no-signup AI-readiness (GEO) check for the public landing page.
 *
 * Returns only a SUMMARY (score, grade, top issues). The full report, the other
 * endpoints and higher volumes stay behind RapidAPI. Rate limited per IP per day.
 * The limiter is in-memory (per warm serverless instance): good enough to stop casual
 * abuse without adding a database; the summary itself is low value to scrapers.
 */

import { fetchTargetPage, parseHtmlMetadata, checkAiReadiness, computeAuditReport } from './analyzer.mjs';

export const FREE_CHECKS_PER_DAY = 5;
const GLOBAL_CHECKS_PER_DAY = 500; // per instance, safety valve
const RAPIDAPI_URL = 'https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor';

const usage = new Map(); // ip -> { day, count }
let globalUsage = { day: '', count: 0 };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function clientIp(headers = {}) {
  const get = name => {
    const v = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const fwd = get('x-forwarded-for');
  if (fwd) return String(fwd).split(',')[0].trim();
  return String(get('x-real-ip') || 'unknown');
}

/** Returns { allowed, remaining } and records the hit when allowed. */
export function takeFreeCheck(ip, now = today()) {
  if (globalUsage.day !== now) globalUsage = { day: now, count: 0 };
  if (globalUsage.count >= GLOBAL_CHECKS_PER_DAY) return { allowed: false, remaining: 0 };

  const rec = usage.get(ip);
  const current = rec && rec.day === now ? rec : { day: now, count: 0 };
  if (current.count >= FREE_CHECKS_PER_DAY) return { allowed: false, remaining: 0 };

  current.count += 1;
  usage.set(ip, current);
  globalUsage.count += 1;
  if (usage.size > 20000) usage.clear(); // keep memory bounded
  return { allowed: true, remaining: FREE_CHECKS_PER_DAY - current.count };
}

export function _resetFreeChecks() {
  usage.clear();
  globalUsage = { day: '', count: 0 };
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2, info: 3 };

export async function runPublicCheck(targetUrl, headers = {}) {
  if (!targetUrl) {
    return { status: 400, body: { success: false, error: 'Missing required query parameter: url' } };
  }

  const quota = takeFreeCheck(clientIp(headers));
  if (!quota.allowed) {
    return {
      status: 429,
      body: {
        success: false,
        error: `Free limit reached (${FREE_CHECKS_PER_DAY} checks per day). Get the full report and higher limits on RapidAPI (free plan available).`,
        upgradeUrl: RAPIDAPI_URL
      }
    };
  }

  const pageData = await fetchTargetPage(targetUrl);
  const meta = parseHtmlMetadata(pageData.html, pageData.finalUrl);
  const aiReadiness = await checkAiReadiness(pageData.origin);
  const audit = computeAuditReport(pageData, meta, aiReadiness);

  const topIssues = [...audit.issues]
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
    .slice(0, 3);

  return {
    status: 200,
    body: {
      success: true,
      url: pageData.finalUrl,
      score: audit.overallScore,
      grade: audit.grade,
      issuesCount: audit.issuesCount,
      topIssues,
      hiddenIssues: Math.max(0, audit.issuesCount - topIssues.length),
      aiReadiness: {
        hasLlmsTxt: Boolean(aiReadiness.hasLlmsTxt),
        blocksAiBots: Boolean(aiReadiness.blocksAiBots),
        blockedBots: aiReadiness.blockedBots || []
      },
      freeChecksRemainingToday: quota.remaining,
      fullReportUrl: RAPIDAPI_URL
    }
  };
}
