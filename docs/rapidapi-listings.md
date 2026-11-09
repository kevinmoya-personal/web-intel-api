# RapidAPI listing copy (ready to paste)

Paste each block into **Studio → Hub Listing → General** (Short Description / Long Description) and click **Save** (the Save bar is at the very bottom of the window; close the blue Terms banner if you can't see it).
Paste the "Docs" block into **Hub Listing → Docs**.

Rule used: lead with the problem it solves, say honestly how it works, show a real call. Overclaiming = bad reviews.

---

## 1. Web2Agent Clean Markdown & SEO GEO Auditor

**Short description**
Turn any URL into clean, LLM-ready Markdown and get an SEO + AI-search (GEO) readiness score with fixes — one call, no headless browser.

**Long description**
Feeding raw HTML to an LLM wastes tokens on menus, scripts and cookie banners. Web2Agent fetches any public page and returns clean Markdown plus a token estimate, ready for RAG pipelines, AI agents and n8n/Make/Zapier automations.

It also audits how "AI-search ready" a site is (Generative Engine Optimization): `/llms.txt`, whether robots.txt blocks GPTBot / ClaudeBot / PerplexityBot / Google-Extended, JSON-LD structured data, title/meta, H1 hierarchy and image alt coverage → a 0–100 score, A–F grade and a list of concrete issues.

**Works great for**
- RAG ingestion and AI agents that need to "read" a web page
- SEO / marketing agencies producing GEO audits for clients at scale
- Lead-gen tools that need a site's tech stack and public contact links
- Content monitoring dashboards

**Endpoints**
- `GET /api/v1/extract?url=` → clean Markdown, word count, token estimate, OpenGraph
- `GET /api/v1/audit?url=` → SEO + GEO score, grade, issues
- `GET /api/v1/tech-stack?url=` → detected technologies, public emails & social profiles
- `GET /api/v1/full-report?url=` → all of the above in one call

**Limits to know**: static HTML only (pages that render everything with client-side JavaScript return little content); 10 s timeout per page; public URLs only.

---

## 2. HTTP Security Headers & OWASP Compliance Auditor

**Short description**
Grade any website's HTTP security headers (CSP, HSTS, X-Frame-Options, CORS…) from A+ to F with copy-paste fixes. Ideal for audits, onboarding checks and CI.

**Long description**
Missing security headers are one of the most common findings in pentests and vendor-security questionnaires. This API fetches a URL and checks the OWASP-recommended headers — Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — plus wildcard CORS and server fingerprint leaks (`Server`, `X-Powered-By`).

You get a weighted 0–100 score, a letter grade and an exact header line to add for every missing control.

**Works great for**
- Web agencies adding a "security check" to client reports
- SaaS vendor-risk / due-diligence tooling
- CI/CD gates that fail a deploy when the grade drops
- Bulk scans of a domain portfolio

**Endpoint**
- `GET /api/v1/security-headers?url=https://example.com`

**Limits to know**: checks response headers of the final page after redirects (passive check — no attack traffic is sent).

---

## 3. AI Prompt Guard, PII Redactor & RAG Chunker

**Short description**
Screen user text before it reaches your LLM: flag prompt-injection/jailbreak patterns, redact emails, phones, cards and API keys, and split it into token-sized RAG chunks.

**Long description**
One lightweight pre-processing call for any LLM app:

1. **Prompt-injection screening** — flags known jailbreak / instruction-override patterns ("ignore previous instructions", role hijacking, system-prompt extraction…) and returns a risk score.
2. **PII redaction** — masks emails, phone numbers, credit-card-like numbers, US SSN/tax IDs, IPv4 addresses and common API keys (OpenAI `sk-`, GitHub `ghp_`, Google `AIza`, AWS `AKIA`) and tells you what was found.
3. **RAG chunking** — splits the redacted text into chunks of your chosen token size (`chunkSize`, default 250).

Pattern-based and deterministic: fast (single-digit ms), no data stored, no third-party model calls. Use it as a first line of defence, not as your only one.

**Works great for**
- Chatbots and support bots that forward user input to an LLM
- Logging pipelines that must not store PII
- Preparing documents for vector databases

**Endpoint**
- `GET|POST /api/v1/ai-guard` — params `text` (required), `chunkSize` (optional)

---

## 4. SERP Preview, Social Card & Link Unfurler

**Short description**
Unfurl any URL into title, description, image, favicon, site name and reading time — the data you need for link previews, social cards and Google SERP previews.

**Long description**
Build Slack/Discord-style link previews or check how a page will look on Google and social networks without writing a scraper. The API reads OpenGraph, Twitter/X card and standard meta tags (with sensible fallbacks), and returns title, description, preview image, high-res favicon, site name, language, canonical URL, word count and estimated reading time — plus a ready-made SERP preview with title/description length checks.

**Works great for**
- Chat, CMS and newsletter tools that show rich link previews
- SEO tools that preview and validate snippets
- Bookmarking / read-later apps

**Endpoint**
- `GET /api/v1/unfurl?url=https://example.com`

---

## 5. DNS, SSL Certificate & Domain Security Recon

**Short description**
One call returns a domain's A/AAAA/MX/NS/TXT records, SPF & DMARC status, SSL certificate issuer and days to expiry, and a 0–100 domain security score.

**Long description**
Stop chaining dig, openssl and online checkers. Send a domain and get:
- DNS: A, AAAA, MX (sorted by priority), NS, TXT
- Email authentication: SPF and DMARC present or missing, with the raw records
- TLS certificate: issuer, subject, SANs, valid-from/to and **days until expiry**
- A 0–100 security score summarising the above

**Works great for**
- Certificate-expiry monitoring for agencies and MSPs
- Email-deliverability audits (missing SPF/DMARC)
- Lead qualification and vendor due diligence

**Endpoints**
- `GET /api/v1/domain-recon?domain=example.com` → full recon
- `GET /api/v1/ssl-check?domain=example.com` → certificate only (faster)

---

## 6. Disposable Email, MX & B2B Lead Validator

**Short description**
Validate emails before they hit your CRM: syntax, MX records, disposable/temporary domains, free vs business provider and role accounts (info@, sales@) with a 0–100 lead score.

**Long description**
Bad sign-ups and throwaway emails pollute your CRM and hurt deliverability. This API checks an address in real time:
- RFC syntax
- Domain has MX records (can receive mail) and which provider hosts it (e.g. Google Workspace, Microsoft 365)
- Disposable / temporary-mail domain
- Free consumer provider (gmail, outlook…) vs business domain
- Role account (info@, sales@, support@…)

Returns `deliverable`, a verdict and a 0–100 quality score so you can block, flag or prioritise leads.

**Works great for**
- Sign-up forms (block disposable emails)
- Cleaning lead lists before outbound campaigns
- Scoring inbound B2B leads by domain quality

**Endpoint**
- `GET /api/v1/email-verify?email=name@company.com`

**Limits to know**: DNS/MX-based — it does not open an SMTP session, so it can't confirm that a specific mailbox exists.

---

## Docs block (same for every project — replace HOST and the example path)

```bash
curl --request GET \
  --url 'https://HOST/api/v1/ENDPOINT?url=https%3A%2F%2Fstripe.com' \
  --header 'x-rapidapi-host: HOST' \
  --header 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'
```

```python
import requests
r = requests.get(
    "https://HOST/api/v1/ENDPOINT",
    params={"url": "https://stripe.com"},
    headers={"x-rapidapi-host": "HOST", "x-rapidapi-key": "YOUR_RAPIDAPI_KEY"},
    timeout=20,
)
print(r.json())
```

```javascript
const res = await fetch(
  "https://HOST/api/v1/ENDPOINT?url=" + encodeURIComponent("https://stripe.com"),
  { headers: { "x-rapidapi-host": "HOST", "x-rapidapi-key": "YOUR_RAPIDAPI_KEY" } }
);
console.log(await res.json());
```

**Errors**: `400` missing parameter · `403` request did not come through RapidAPI · `502` target site unreachable or blocked (private/local addresses are refused).
