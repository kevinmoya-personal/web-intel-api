# n8n templates

Ready-to-import n8n workflows built on these APIs. In n8n: **Workflows → Import from File** and pick a `.json`.

| Template | What it does | API used |
| :--- | :--- | :--- |
| [`geo-seo-audit-to-google-sheets.json`](geo-seo-audit-to-google-sheets.json) | Every Monday, audits a list of websites for AI-search (GEO) + SEO readiness and writes score, grade and top issues to Google Sheets. | [Web2Agent](https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor) |
| [`block-disposable-emails-at-signup.json`](block-disposable-emails-at-signup.json) | Webhook your sign-up form calls to block disposable / fake emails in ~0.5 s. Fails open if the API is down. | [Disposable Email Validator](https://rapidapi.com/kevinmoyapersonal/api/disposable-email-mx-b2b-lead-validator) |
| [`ssl-certificate-expiry-monitor.json`](ssl-certificate-expiry-monitor.json) | Daily check of your domains' TLS certificates; emails you only when one is invalid or expires within 21 days. | [DNS & SSL Recon](https://rapidapi.com/kevinmoyapersonal/api/dns-ssl-certificate-domain-security-recon) |

## One-time credential

1. Subscribe to the API on RapidAPI (the BASIC plan is free: 50 requests/month).
2. In n8n: **Credentials → New → Header Auth** — Name `x-rapidapi-key`, Value = your RapidAPI key.
3. Select it in the workflow's HTTP Request node.

No API key is stored in the JSON files. Each workflow contains sticky notes with setup steps and limitations.

## Example output (real audit of https://example.com, Nov 2026)

| url | score | grade | issues_count | top_issues (sorted by severity) |
| :--- | :---: | :---: | :---: | :--- |
| https://example.com | 34 | D | 8 | `[high] SEO: Missing meta description.` · `[high] Structure: No <h1> heading found on the page.` · `[medium] SEO: Missing rel="canonical" link tag.` · `[low] SEO: Title length (14 chars) is outside optimal 15–70 chars range.` |

(example.com's current page really has no `<h1>`: it was redesigned as a minimal page.)
