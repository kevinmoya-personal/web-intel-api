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

## Example output (GEO audit of https://example.com)

| url | score | grade | issues_count | has_llms_txt | ai_bots_blocked | top_issues |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| https://example.com | 34 | D | 8 | no | none | `[high] SEO: Missing meta description.` · `[high] Structure: No <h1> heading found on the page.` · `[medium] AI-Readiness (GEO): No JSON-LD (Schema.org) structured data found…` |
