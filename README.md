# 🚀 Web2Agent Clean Markdown & SEO/GEO Intelligence API

[![RapidAPI Hub](https://img.shields.io/badge/RapidAPI-Subscribe%20Now-0055da?style=for-the-badge&logo=fastapi)](https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor)
[![Live Playground](https://img.shields.io/badge/Live%20Demo-web--intel--api.vercel.app-10b981?style=for-the-badge)](https://web-intel-api.vercel.app)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0%20Spec-f59e0b?style=for-the-badge)](https://web-intel-api.vercel.app/openapi.json)

Convert any webpage URL into **clean LLM-ready Markdown**, run instant **Technical SEO & AI-Readiness (GEO / `/llms.txt` / Schema.org JSON-LD)** audits, and enrich B2B domains with **technology stack fingerprinting & public contacts** in milliseconds.

👉 **Get your API Key on RapidAPI Hub:** [https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor](https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor)

---

## ⚡ Production Endpoints

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/v1/extract?url=https://...` | `GET` / `POST` | Strips scripts, ads & boilerplate HTML. Returns clean Markdown, word count, estimated LLM token count, and OpenGraph metadata. |
| `/api/v1/audit?url=https://...` | `GET` / `POST` | Computes a `0–100` SEO & AI GEO Readiness score (`A`–`F` grade), checking `/llms.txt`, `robots.txt` AI crawler permissions (`GPTBot`, `ClaudeBot`, `PerplexityBot`), `JSON-LD` structured data, headings, and image alt coverage. |
| `/api/v1/tech-stack?url=https://...` | `GET` / `POST` | Detects frameworks, CMS, e-commerce, analytics, payment providers (Next.js, Shopify, Stripe, HubSpot, Cloudflare, etc.) and extracts public emails & social profiles. |
| `/api/v1/full-report?url=https://...` | `GET` / `POST` | Complete 3-in-1 intelligence report in a single request. |

---

## 💳 Pricing Plans on RapidAPI

- **BASIC ($0.00 / mo):** 50 requests/month — Free forever for testing & prototyping.
- **PRO ($9.99 / mo):** 5,000 requests/month (`+$0.003` per extra request) — Ideal for AI Agents, n8n/Make automations & SEO dashboards.
- **ULTRA ($29.99 / mo):** 25,000 requests/month (`+$0.002` per extra request) — Built for high-volume B2B enrichment & SaaS platforms.

👉 **[Subscribe on RapidAPI Marketplace](https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor)**

---

## 🔒 Security & Deployment

All `/api/v1/*` endpoints only answer requests that come through the RapidAPI gateway (header `X-RapidAPI-Proxy-Secret`). The landing page (`/`), `/openapi.json` and `/api/v1/health` stay public.

| Variable | Required | Description |
| :--- | :---: | :--- |
| `RAPIDAPI_PROXY_SECRETS` | ✅ on Vercel | Comma-separated list with the proxy secret of **each** RapidAPI project that uses this backend (Studio → Hub Listing → Gateway). |
| `RAPIDAPI_PROXY_SECRET_1` … `_6` | alternative | One variable per project instead of the comma list (easier to paste). |
| `RAPIDAPI_PROXY_SECRET` | – | Legacy single secret (still accepted). |
| `ALLOW_UNAUTHENTICATED` | – | `true` disables the check on Vercel. Only for demos — never in production. |

If no secret is configured, the paid endpoints answer **503** on Vercel (fail closed), so a missing variable never exposes the API for free. Locally (`npm start`) the check is skipped when no secret is set.

URL-fetching endpoints validate the target host and every redirect hop against private/reserved IP ranges (SSRF protection).

```bash
npm test              # unit tests (auth + SSRF)
npm run test:live     # live smoke test against real websites
```
