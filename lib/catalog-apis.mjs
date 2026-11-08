import dns from 'node:dns/promises';
import tls from 'node:tls';
import { fetchTargetPage, parseHtmlMetadata } from './analyzer.mjs';

// ============================================================================
// API #2: Disposable Email, MX & B2B Lead Validator API
// ============================================================================
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'getnada.com', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com',
  'mailnesia.com', 'mohmal.com', 'throwawaymail.com', 'burnermail.io',
  'guerrillamailblock.com', 'pokemail.net', 'spam4.me', 'grr.la',
  'mailcatch.com', 'emailondeck.com', 'mintemail.com', 'tempail.com'
]);

const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.es', 'yahoo.co.uk',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com',
  'me.com', 'aol.com', 'protonmail.com', 'proton.me', 'zoho.com',
  'gmx.com', 'mail.com', 'yandex.com'
]);

const ROLE_PREFIXES = new Set([
  'admin', 'administrator', 'support', 'help', 'info', 'contact', 'sales',
  'billing', 'accounts', 'office', 'team', 'careers', 'hr', 'jobs',
  'press', 'media', 'legal', 'privacy', 'security', 'noreply', 'no-reply',
  'webmaster', 'postmaster', 'hostmaster', 'marketing', 'hello'
]);

function detectEmailProviderFromMx(mxRecords) {
  const joined = mxRecords.map(r => r.exchange.toLowerCase()).join(' ');
  if (joined.includes('google.com') || joined.includes('googlemail.com')) return 'Google Workspace / Gmail';
  if (joined.includes('outlook.com') || joined.includes('protection.outlook.com')) return 'Microsoft 365 / Exchange Online';
  if (joined.includes('pphosted.com') || joined.includes('proofpoint')) return 'Proofpoint Enterprise';
  if (joined.includes('mimecast.com')) return 'Mimecast';
  if (joined.includes('zoho.com') || joined.includes('zoho.eu')) return 'Zoho Mail';
  if (joined.includes('protonmail.ch') || joined.includes('proton.me')) return 'Proton Mail';
  if (joined.includes('yahoodns.net')) return 'Yahoo Mail';
  if (joined.includes('icloud.com')) return 'Apple iCloud Mail';
  if (joined.includes('secureserver.net')) return 'GoDaddy Workspace';
  if (joined.includes('registrar-servers.com') || joined.includes('privateemail.com')) return 'Namecheap PrivateEmail';
  if (joined.includes('cloudflare.net')) return 'Cloudflare Email Routing';
  if (joined.includes('amazonaws.com') || joined.includes('awsapps.com')) return 'Amazon SES / WorkMail';
  if (joined.includes('fastmail.com')) return 'Fastmail';
  return mxRecords.length > 0 ? 'Custom / Self-Hosted SMTP' : null;
}

export async function validateEmailAndDomain(emailInput) {
  const raw = String(emailInput || '').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isSyntaxValid = emailRegex.test(raw);

  if (!isSyntaxValid) {
    return {
      email: raw,
      isValidSyntax: false,
      deliverable: false,
      qualityScore: 0,
      verdict: 'invalid_syntax',
      reason: 'Email address failed RFC syntax validation.'
    };
  }

  const [userPart, domainPart] = raw.toLowerCase().split('@');
  const cleanUser = userPart.split('+')[0];
  const hasPlusAlias = userPart.includes('+');
  const isRoleAccount = ROLE_PREFIXES.has(cleanUser);
  const isFreeProvider = FREE_EMAIL_PROVIDERS.has(domainPart);
  const isDisposable =
    DISPOSABLE_DOMAINS.has(domainPart) ||
    /(tempmail|throwaway|burner|trashmail|10minutemail|guerrilla)/i.test(domainPart);

  let mxRecords = [];
  let hasMxRecords = false;
  let spfRecord = null;
  let dmarcRecord = null;

  try {
    const mx = await dns.resolveMx(domainPart);
    mxRecords = mx
      .sort((a, b) => a.priority - b.priority)
      .map(r => ({ exchange: r.exchange, priority: r.priority }));
    hasMxRecords = mxRecords.length > 0;
  } catch {
    hasMxRecords = false;
  }

  try {
    const txt = await dns.resolveTxt(domainPart);
    const flatTxt = txt.map(chunks => chunks.join(''));
    spfRecord = flatTxt.find(t => t.toLowerCase().startsWith('v=spf1')) || null;
  } catch {
    spfRecord = null;
  }

  try {
    const dmarcTxt = await dns.resolveTxt(`_dmarc.${domainPart}`);
    const flatDmarc = dmarcTxt.map(chunks => chunks.join(''));
    dmarcRecord = flatDmarc.find(t => t.toLowerCase().startsWith('v=dmarc1')) || null;
  } catch {
    dmarcRecord = null;
  }

  const mailProvider = detectEmailProviderFromMx(mxRecords);
  const isB2BCorporate = !isFreeProvider && !isDisposable && hasMxRecords;

  let score = 100;
  if (!hasMxRecords) score -= 85;
  if (isDisposable) score -= 90;
  if (isRoleAccount) score -= 15;
  if (isFreeProvider) score -= 10;
  if (hasPlusAlias) score -= 5;
  if (!spfRecord) score -= 5;
  score = Math.max(0, Math.min(100, score));

  let verdict = 'deliverable';
  if (!hasMxRecords || isDisposable) verdict = 'undeliverable_or_disposable';
  else if (isRoleAccount) verdict = 'risky_role_account';

  return {
    email: raw.toLowerCase(),
    user: userPart,
    domain: domainPart,
    isValidSyntax: true,
    deliverable: hasMxRecords && !isDisposable,
    verdict,
    qualityScore: score,
    flags: {
      isDisposable,
      isFreeProvider,
      isB2BCorporate,
      isRoleAccount,
      hasPlusAlias
    },
    mailServer: {
      hasMxRecords,
      provider: mailProvider,
      mxRecords: mxRecords.slice(0, 5),
      hasSpf: Boolean(spfRecord),
      spfRecord,
      hasDmarc: Boolean(dmarcRecord),
      dmarcRecord
    }
  };
}

// ============================================================================
// API #3: DNS, SSL Certificate & Domain Security Recon API
// ============================================================================
export function inspectSslCertificate(hostname, timeoutMs = 5000) {
  return new Promise(resolve => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(false);
          const protocol = socket.getProtocol();
          const cipher = socket.getCipher();
          const authorized = socket.authorized;
          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            resolve({ valid: false, error: 'No peer certificate presented' });
            return;
          }

          const validFrom = cert.valid_from ? new Date(cert.valid_from).toISOString() : null;
          const validTo = cert.valid_to ? new Date(cert.valid_to).toISOString() : null;
          const daysRemaining = validTo
            ? Math.floor((new Date(validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          resolve({
            valid: daysRemaining !== null && daysRemaining > 0,
            authorizedByCA: Boolean(authorized),
            protocol,
            cipher: cipher ? cipher.name : null,
            subject: cert.subject || null,
            issuer: cert.issuer || null,
            validFrom,
            validTo,
            daysRemaining,
            isExpiringSoon: daysRemaining !== null ? daysRemaining <= 14 : false,
            serialNumber: cert.serialNumber || null,
            fingerprint256: cert.fingerprint256 || null,
            subjectAltNames: cert.subjectaltname
              ? cert.subjectaltname.split(',').map(s => s.trim().replace(/^DNS:/, '')).slice(0, 20)
              : []
          });
        } catch (err) {
          socket.destroy();
          resolve({ valid: false, error: err.message });
        }
      }
    );

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ valid: false, error: 'TLS handshake timed out' });
    });

    socket.on('error', err => {
      resolve({ valid: false, error: err.message });
    });
  });
}

export async function runDomainRecon(domainOrUrl) {
  let raw = String(domainOrUrl || '').trim();
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  const parsed = new URL(raw);
  const hostname = parsed.hostname.replace(/^www\./i, '');

  const [aRes, aaaaRes, mxRes, nsRes, txtRes, dmarcRes, sslInfo] = await Promise.all([
    dns.resolve4(hostname).catch(() => []),
    dns.resolve6(hostname).catch(() => []),
    dns.resolveMx(hostname).catch(() => []),
    dns.resolveNs(hostname).catch(() => []),
    dns.resolveTxt(hostname).catch(() => []),
    dns.resolveTxt(`_dmarc.${hostname}`).catch(() => []),
    inspectSslCertificate(hostname)
  ]);

  const flatTxt = txtRes.map(c => c.join(''));
  const flatDmarc = dmarcRes.map(c => c.join(''));
  const spf = flatTxt.find(t => t.toLowerCase().startsWith('v=spf1')) || null;
  const dmarc = flatDmarc.find(t => t.toLowerCase().startsWith('v=dmarc1')) || null;

  let securityScore = 100;
  if (!sslInfo.valid) securityScore -= 40;
  if (!spf) securityScore -= 20;
  if (!dmarc) securityScore -= 20;
  if (nsRes.length < 2) securityScore -= 10;
  if (aaaaRes.length === 0) securityScore -= 10;

  return {
    domain: hostname,
    securityScore: Math.max(0, securityScore),
    dns: {
      ipv4: aRes,
      ipv6: aaaaRes,
      nameservers: nsRes,
      mx: mxRes.sort((a, b) => a.priority - b.priority),
      txt: flatTxt.slice(0, 15)
    },
    emailAuth: {
      hasSpf: Boolean(spf),
      spfRecord: spf,
      hasDmarc: Boolean(dmarc),
      dmarcRecord: dmarc
    },
    ssl: sslInfo
  };
}

// ============================================================================
// API #4: SERP Preview, Social Card & Link Unfurler API
// ============================================================================
export async function unfurlLink(targetUrl) {
  const pageData = await fetchTargetPage(targetUrl);
  const meta = parseHtmlMetadata(pageData.html, pageData.finalUrl);

  const title = meta.openGraph['og:title'] || meta.twitterCard['twitter:title'] || meta.title || pageData.hostname;
  const description =
    meta.openGraph['og:description'] ||
    meta.twitterCard['twitter:description'] ||
    meta.description ||
    '';
  const image =
    meta.openGraph['og:image'] ||
    meta.twitterCard['twitter:image'] ||
    meta.twitterCard['twitter:image:src'] ||
    null;
  const siteName = meta.openGraph['og:site_name'] || pageData.hostname;
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(pageData.hostname)}&sz=128`;

  const cleanTextWords = pageData.html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const estimatedReadingMinutes = Math.max(1, Math.ceil(cleanTextWords / 200));

  return {
    url: pageData.finalUrl,
    hostname: pageData.hostname,
    responseTimeMs: pageData.responseTimeMs,
    unfurl: {
      title,
      description,
      siteName,
      image,
      favicon,
      language: meta.language,
      canonical: meta.canonical,
      wordCount: cleanTextWords,
      estimatedReadingMinutes
    },
    serpPreview: {
      displayUrl: pageData.finalUrl.replace(/^https?:\/\//, ''),
      truncatedTitle: title.length > 60 ? title.slice(0, 57) + '...' : title,
      truncatedDescription: description.length > 160 ? description.slice(0, 157) + '...' : description,
      titlePixelSafe: title.length <= 60,
      descriptionPixelSafe: description.length >= 50 && description.length <= 160
    },
    socialCards: {
      hasOpenGraphImage: Boolean(meta.openGraph['og:image']),
      openGraph: meta.openGraph,
      twitterCard: meta.twitterCard
    }
  };
}

// ============================================================================
// API #5: AI Prompt Security, PII Redactor & RAG Chunker API
// ============================================================================
const PROMPT_INJECTION_PATTERNS = [
  { id: 'ignore_previous', label: 'Ignore Previous Instructions Override', regex: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules|directions)/i, severity: 'high' },
  { id: 'system_prompt_leak', label: 'System Prompt Extraction Attempt', regex: /(reveal|print|show|output|repeat|leak)\s+(your|the)\s+(system\s+prompt|hidden\s+instructions|initial\s+prompt|developer\s+message)/i, severity: 'high' },
  { id: 'jailbreak_dan', label: 'Persona / Jailbreak Mode Override', regex: /\b(do\s+anything\s+now|DAN\s+mode|developer\s+mode\s+enabled|act\s+as\s+an?\s+unrestricted|bypass\s+safety\s+filters)\b/i, severity: 'high' },
  { id: 'delimiter_escape', label: 'System Role Delimiter Spoofing', regex: /(<\|\s*(im_start|system|endoftext)\s*\|>|\[SYSTEM\]|###\s*System\s*Instruction)/i, severity: 'medium' },
  { id: 'credential_exfil', label: 'Secret / API Key Exfiltration Command', regex: /(process\.env|printenv|cat\s+\.env|send\s+to\s+https?:\/\/|curl\s+-X\s+POST)/i, severity: 'high' }
];

export function analyzeAndRedactText(textInput, chunkSizeTokens = 250) {
  const raw = String(textInput || '');
  const detections = [];

  let redacted = raw;

  const piiRules = [
    { type: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
    { type: 'CREDIT_CARD', regex: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[REDACTED_CARD]' },
    { type: 'SSN_OR_TAX_ID', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
    { type: 'API_KEY_SECRET', regex: /\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{25,}|AIza[0-9A-Za-z-_]{35}|AKIA[0-9A-Z]{16})\b/g, replacement: '[REDACTED_API_KEY]' },
    { type: 'IPV4_ADDRESS', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[REDACTED_IP]' },
    { type: 'PHONE_NUMBER', regex: /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g, replacement: '[REDACTED_PHONE]' }
  ];

  for (const rule of piiRules) {
    const matches = raw.match(rule.regex) || [];
    if (matches.length > 0) {
      detections.push({ type: rule.type, count: matches.length });
      redacted = redacted.replace(rule.regex, rule.replacement);
    }
  }

  const injectionHits = [];
  for (const pat of PROMPT_INJECTION_PATTERNS) {
    if (pat.regex.test(raw)) {
      injectionHits.push({ id: pat.id, label: pat.label, severity: pat.severity });
    }
  }

  const riskScore = Math.min(
    100,
    injectionHits.reduce((acc, h) => acc + (h.severity === 'high' ? 45 : 25), 0) +
      (detections.some(d => d.type === 'API_KEY_SECRET') ? 35 : 0)
  );

  // Build token-aware RAG chunks
  const words = redacted.split(/\s+/).filter(Boolean);
  const wordsPerChunk = Math.max(20, Math.floor(chunkSizeTokens * 0.75));
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const slice = words.slice(i, i + wordsPerChunk).join(' ');
    chunks.push({
      index: chunks.length,
      text: slice,
      estimatedTokens: Math.ceil(slice.length / 4)
    });
  }

  return {
    originalLength: raw.length,
    estimatedTokens: Math.ceil(raw.length / 4),
    promptSecurity: {
      isSafe: injectionHits.length === 0,
      riskScore,
      verdict: injectionHits.length === 0 ? 'safe' : 'prompt_injection_detected',
      threatsDetected: injectionHits
    },
    piiRedaction: {
      piiFound: detections.length > 0,
      totalPiiEntities: detections.reduce((sum, d) => sum + d.count, 0),
      entitiesByType: detections,
      redactedText: redacted
    },
    ragChunks: chunks
  };
}

// ============================================================================
// API #6: HTTP Security Headers & OWASP Compliance Auditor API
// ============================================================================
export async function auditHttpSecurityHeaders(targetUrl) {
  const pageData = await fetchTargetPage(targetUrl);
  const h = pageData.headers || {};

  const checks = [
    {
      header: 'strict-transport-security',
      present: Boolean(h['strict-transport-security']),
      value: h['strict-transport-security'] || null,
      weight: 20,
      recommendation: 'Add "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload" to enforce HTTPS.'
    },
    {
      header: 'content-security-policy',
      present: Boolean(h['content-security-policy']),
      value: h['content-security-policy'] || null,
      weight: 25,
      recommendation: 'Define a Content-Security-Policy (CSP) header to mitigate XSS and data injection attacks.'
    },
    {
      header: 'x-frame-options',
      present: Boolean(h['x-frame-options']) || /frame-ancestors/i.test(h['content-security-policy'] || ''),
      value: h['x-frame-options'] || null,
      weight: 15,
      recommendation: 'Add "X-Frame-Options: SAMEORIGIN" or CSP frame-ancestors to prevent clickjacking.'
    },
    {
      header: 'x-content-type-options',
      present: (h['x-content-type-options'] || '').toLowerCase() === 'nosniff',
      value: h['x-content-type-options'] || null,
      weight: 15,
      recommendation: 'Add "X-Content-Type-Options: nosniff" to block MIME-sniffing attacks.'
    },
    {
      header: 'referrer-policy',
      present: Boolean(h['referrer-policy']),
      value: h['referrer-policy'] || null,
      weight: 10,
      recommendation: 'Add "Referrer-Policy: strict-origin-when-cross-origin" to protect referrer privacy.'
    },
    {
      header: 'permissions-policy',
      present: Boolean(h['permissions-policy']),
      value: h['permissions-policy'] || null,
      weight: 10,
      recommendation: 'Add "Permissions-Policy: camera=(), microphone=(), geolocation=()" to restrict browser APIs.'
    },
    {
      header: 'x-powered-by-hidden',
      present: !h['x-powered-by'],
      value: h['x-powered-by'] || 'hidden (good)',
      weight: 5,
      recommendation: 'Remove the "X-Powered-By" header so attackers cannot fingerprint your backend framework.'
    }
  ];

  const score = checks.reduce((sum, c) => sum + (c.present ? c.weight : 0), 0);
  const grade =
    score >= 90 ? 'A+' :
    score >= 80 ? 'A' :
    score >= 70 ? 'B' :
    score >= 55 ? 'C' :
    score >= 40 ? 'D' : 'F';

  return {
    url: pageData.finalUrl,
    hostname: pageData.hostname,
    responseTimeMs: pageData.responseTimeMs,
    score,
    grade,
    corsPolicy: {
      accessControlAllowOrigin: h['access-control-allow-origin'] || null,
      isWildcardCors: h['access-control-allow-origin'] === '*'
    },
    serverFingerprint: {
      server: h['server'] || null,
      xPoweredBy: h['x-powered-by'] || null
    },
    checks,
    missingHeaders: checks.filter(c => !c.present).map(c => ({
      header: c.header,
      remediation: c.recommendation
    }))
  };
}
