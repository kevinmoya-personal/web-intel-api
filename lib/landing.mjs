/**
 * Landing page (server-rendered in English at "/" and Spanish at "/es").
 *
 * The free checker is the hero. Results are shareable through "?url=" permalinks.
 * Two conversion paths: developers -> RapidAPI; site owners -> done-for-you audit
 * (shown only when CONTACT_URL is configured).
 */

const SITE = 'https://web-intel-api.vercel.app';
const RAPIDAPI = 'https://rapidapi.com/kevinmoyapersonal/api/web2agent-clean-markdown-seo-geo-auditor';

const TEXT = {
  en: {
    path: '/',
    altPath: '/es',
    altLabel: 'Español',
    title: 'Free AI Search (GEO) Checker – Can ChatGPT read your site?',
    description: 'Free check: can ChatGPT, Perplexity and Google AI read your website? Audits /llms.txt, AI crawlers, structured data and meta tags. No signup.',
    ogTitle: 'Can ChatGPT read your website? Free AI-search (GEO) checker',
    ogDescription: 'Score 0–100 with the exact issues blocking AI search engines. No signup.',
    ogImage: '/og.png',
    badge: 'Free · No signup',
    h1: 'Can ChatGPT, Perplexity &amp; Google AI read your website?',
    lead: 'More and more customers ask an AI for recommendations instead of searching Google. If the AI cannot read your site, you are not in the answer. Check yours in 10 seconds.',
    placeholder: 'https://yourwebsite.com',
    button: 'Check my site',
    limit: '5 free checks per day. No account needed.',
    whatTitle: 'What we check',
    what1: '<b>AI crawler access</b> — whether robots.txt blocks GPTBot, ClaudeBot, PerplexityBot or Google-Extended.',
    what2: '<b>/llms.txt</b> — the emerging guide file for AI agents.',
    what3: '<b>Structured data</b> — JSON-LD (Schema.org) that tells AI what your business is.',
    what4: '<b>Page basics</b> — title, description, canonical, headings and image alt text.',
    honest: 'A good score means AI engines can read your page. It does not guarantee they will recommend you.',
    devTitle: 'For developers: API &amp; MCP server',
    devLead: 'Run the full audit (and 5 more web-intelligence APIs) from your code, n8n or AI agents. Free plan: 50 requests/month, no credit card.',
    devCta: 'Get a free API key on RapidAPI',
    mcpLead: 'MCP server for Claude, Cursor and other agents (uses your RapidAPI key):',
    n8n: 'Ready-to-import n8n templates',
    footer: 'Built by Kevin Moya · Static HTML analysis · Public URLs only'
  },
  es: {
    path: '/es',
    altPath: '/',
    altLabel: 'English',
    title: '¿ChatGPT puede leer tu página web? Verificador gratis (GEO)',
    description: 'Revisa gratis si ChatGPT, Perplexity y la IA de Google pueden leer tu sitio web. Puntaje de 0 a 100 y qué corregir. Sin registro.',
    ogTitle: '¿ChatGPT puede leer tu página web? Revísalo gratis',
    ogDescription: 'Puntaje de 0 a 100 y los problemas que impiden que la IA recomiende tu negocio. Sin registro.',
    ogImage: '/og-es.png',
    badge: 'Gratis · Sin registro',
    h1: '¿ChatGPT, Perplexity y la IA de Google pueden leer tu página web?',
    lead: 'Cada vez más clientes le piden recomendaciones a una IA en vez de buscar en Google. Si la IA no puede leer tu sitio, tu negocio no aparece en la respuesta. Revísalo en 10 segundos.',
    placeholder: 'https://tunegocio.com',
    button: 'Revisar mi sitio',
    limit: '5 revisiones gratis al día. No necesitas cuenta.',
    whatTitle: 'Qué revisamos',
    what1: '<b>Acceso de las IA</b> — si tu archivo robots.txt bloquea a ChatGPT, Claude, Perplexity o Google.',
    what2: '<b>/llms.txt</b> — el nuevo archivo guía para agentes de IA.',
    what3: '<b>Datos estructurados</b> — el código (JSON-LD) que le explica a la IA qué es tu negocio.',
    what4: '<b>Lo básico de la página</b> — título, descripción, encabezados y texto de las imágenes.',
    honest: 'Un buen puntaje significa que la IA puede leer tu página. No garantiza que te recomiende.',
    devTitle: 'Para desarrolladores: API y servidor MCP',
    devLead: 'Ejecuta la auditoría completa (y 5 APIs más) desde tu código, n8n o agentes de IA. Plan gratis: 50 solicitudes al mes, sin tarjeta.',
    devCta: 'Obtener una API key gratis en RapidAPI',
    mcpLead: 'Servidor MCP para Claude, Cursor y otros agentes (usa tu key de RapidAPI):',
    n8n: 'Plantillas de n8n listas para importar',
    footer: 'Hecho por Kevin Moya · Analiza HTML estático · Solo URLs públicas'
  }
};

// Strings used by the browser script
const CLIENT = {
  en: {
    checking: 'Checking…', analyzing: 'Analyzing', button: 'Check my site',
    grade: 'grade', issues: 'issues', found: 'found', missing: 'missing',
    bots: 'AI crawlers in robots.txt', notBlocked: 'Not blocked', blocks: 'Blocks',
    more: 'more issues in the full report.', left: 'free checks left today.',
    share: 'Share this result', whatsapp: 'WhatsApp', copy: 'Copy link', copied: 'Copied!',
    shareText: 'scores {score}/100 for AI search readiness. Check your site free:',
    devCta: 'Full report via API (free plan) →',
    serviceTitle: 'Want it fixed for you?',
    serviceText: 'Get the complete audit with every issue and the exact corrections, done by a specialist.',
    serviceCta: 'Request the full audit',
    netError: 'Network error. Please try again.', failed: 'Could not analyze that URL.',
    moreChecks: 'Get more checks on RapidAPI →',
    sev: { high: 'high', medium: 'medium', low: 'low', info: 'info' }
  },
  es: {
    checking: 'Revisando…', analyzing: 'Analizando', button: 'Revisar mi sitio',
    grade: 'nota', issues: 'problemas', found: 'encontrado', missing: 'no existe',
    bots: 'Acceso de las IA (robots.txt)', notBlocked: 'Permitido', blocks: 'Bloquea a',
    more: 'problemas más en el informe completo.', left: 'revisiones gratis te quedan hoy.',
    share: 'Comparte este resultado', whatsapp: 'WhatsApp', copy: 'Copiar enlace', copied: '¡Copiado!',
    shareText: 'saca {score}/100 en preparación para búsquedas con IA. Revisa tu sitio gratis:',
    devCta: 'Informe completo por API (plan gratis) →',
    serviceTitle: '¿Quieres que lo arreglemos por ti?',
    serviceText: 'Recibe la auditoría completa con todos los problemas y las correcciones exactas, hecha por un especialista.',
    serviceCta: 'Pedir la auditoría completa',
    netError: 'Error de red. Intenta de nuevo.', failed: 'No se pudo analizar esa URL.',
    moreChecks: 'Más revisiones en RapidAPI →',
    sev: { high: 'alto', medium: 'medio', low: 'bajo', info: 'info' }
  }
};

const TEMPLATE = String.raw`<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{title}}</title>
  <meta name="description" content="{{description}}" />
  <link rel="canonical" href="{{site}}{{path}}" />
  <link rel="alternate" hreflang="en" href="{{site}}/" />
  <link rel="alternate" hreflang="es" href="{{site}}/es" />
  <link rel="alternate" hreflang="x-default" href="{{site}}/" />
  <meta property="og:title" content="{{ogTitle}}" />
  <meta property="og:description" content="{{ogDescription}}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{{site}}{{path}}" />
  <meta property="og:image" content="{{site}}{{ogImage}}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{{ogTitle}}" />
  <meta name="twitter:image" content="{{site}}{{ogImage}}" />
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"Web2Agent AI Search (GEO) Checker","url":"{{site}}{{path}}","inLanguage":"{{lang}}","applicationCategory":"DeveloperApplication","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":"{{description}}"}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="/_vercel/insights/script.js"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans">
  <div class="max-w-3xl mx-auto px-5 py-10">
    <div class="flex items-center justify-between mb-8">
      <span class="font-bold text-slate-200">Web2Agent</span>
      <a href="{{altPath}}" class="text-sm text-slate-400 hover:text-white underline">{{altLabel}}</a>
    </div>

    <div class="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-4">{{badge}}</div>
    <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">{{h1}}</h1>
    <p class="text-slate-400 text-lg mb-6">{{lead}}</p>

    <div id="check" class="bg-slate-900 border border-emerald-500/40 rounded-xl p-5 mb-10 shadow-xl">
      <form id="checkForm" class="flex flex-col sm:flex-row gap-3">
        <input id="checkUrl" type="text" inputmode="url" required placeholder="{{placeholder}}" class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-emerald-500" />
        <button id="checkBtn" type="submit" class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-lg">{{button}}</button>
      </form>
      <div id="checkOut" class="mt-5 hidden"></div>
      <p class="text-xs text-slate-500 mt-3">{{limit}}</p>
    </div>

    <h2 class="text-xl font-bold mb-3">{{whatTitle}}</h2>
    <ul class="space-y-2 text-slate-300 text-sm mb-3">
      <li>{{what1}}</li>
      <li>{{what2}}</li>
      <li>{{what3}}</li>
      <li>{{what4}}</li>
    </ul>
    <p class="text-xs text-slate-500 mb-12">{{honest}}</p>

    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h2 class="text-lg font-semibold mb-2">{{devTitle}}</h2>
      <p class="text-sm text-slate-400 mb-4">{{devLead}}</p>
      <a href="{{rapidapi}}" target="_blank" rel="noopener" class="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-lg text-sm mb-5">{{devCta}}</a>
      <pre class="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-emerald-300 overflow-x-auto mb-4">curl 'https://web2agent-clean-markdown-seo-geo-auditor.p.rapidapi.com/api/v1/audit?url=https%3A%2F%2Fstripe.com' \
  -H 'x-rapidapi-host: web2agent-clean-markdown-seo-geo-auditor.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'</pre>
      <p class="text-sm text-slate-400 mb-2">{{mcpLead}}</p>
      <pre class="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-emerald-300 overflow-x-auto mb-4">{
  "mcpServers": {
    "web2agent": {
      "type": "http",
      "url": "https://web-intel-api.vercel.app/mcp",
      "headers": { "x-rapidapi-key": "YOUR_RAPIDAPI_KEY" }
    }
  }
}</pre>
      <p class="text-sm"><a class="text-emerald-400 underline" href="https://github.com/kevinmoya-personal/web-intel-api/tree/main/examples/n8n" target="_blank" rel="noopener">{{n8n}}</a> · <a class="text-emerald-400 underline" href="/openapi.json">OpenAPI</a> · <a class="text-emerald-400 underline" href="/llms.txt">llms.txt</a></p>
    </div>

    <p class="text-xs text-slate-600 mt-10">{{footer}}</p>
  </div>
  <script>
    var L = {{clientJson}};
    var LANG = '{{lang}}';
    var CONTACT_URL = {{contactJson}};
    var PAGE = '{{site}}{{path}}';
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var sevColor = { high: 'text-red-400', medium: 'text-amber-400', low: 'text-sky-400', info: 'text-slate-400' };
    // Plain-language Spanish versions of the audit messages
    var ES_RULES = [
      [/^Missing <title> tag\.$/, 'La página no tiene título (<title>).'],
      [/^Title length \((\d+) chars\).*$/, 'El título tiene $1 caracteres; lo ideal es entre 15 y 70.'],
      [/^Missing meta description\.$/, 'Falta la descripción de la página (meta description): es el resumen que leen Google y las IA.'],
      [/^Meta description length \((\d+) chars\).*$/, 'La descripción tiene $1 caracteres; lo ideal es entre 50 y 160.'],
      [/^No <h1> heading found on the page\.$/, 'La página no tiene un encabezado principal (<h1>).'],
      [/^Multiple <h1> tags found \((\d+)\).*$/, 'Hay $1 encabezados principales (<h1>); debería haber uno solo.'],
      [/^Missing rel="canonical" link tag\.$/, 'Falta la etiqueta canonical, que indica cuál es la dirección oficial de la página.'],
      [/^Incomplete OpenGraph tags.*$/, 'Faltan etiquetas para compartir en redes (título o imagen de vista previa).'],
      [/^(\d+) of (\d+) images are missing alt attributes\.$/, '$1 de $2 imágenes no tienen texto alternativo (alt): la IA no sabe qué muestran.'],
      [/^No JSON-LD.*$/, 'No hay datos estructurados (JSON-LD): la IA no tiene una ficha clara de qué es tu negocio.'],
      [/^No \/llms\.txt file found.*$/, 'No existe el archivo /llms.txt que guía a los agentes de IA.'],
      [/^robots\.txt blocks AI crawlers: (.*)$/, 'Tu robots.txt bloquea a estas IA: $1'],
      [/^Missing Strict-Transport-Security.*$/, 'Falta la cabecera de seguridad HSTS.']
    ];
    var ES_CAT = { 'SEO': 'SEO', 'Structure': 'Estructura', 'Social': 'Redes', 'Accessibility': 'Accesibilidad', 'AI-Readiness (GEO)': 'IA (GEO)', 'Security': 'Seguridad' };
    function trMsg(m) {
      if (LANG !== 'es') return m;
      for (var i = 0; i < ES_RULES.length; i++) { if (ES_RULES[i][0].test(m)) return m.replace(ES_RULES[i][0], ES_RULES[i][1]); }
      return m;
    }
    function trCat(c) { return LANG === 'es' ? (ES_CAT[c] || c) : c; }
    function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }

    var form = document.getElementById('checkForm');
    var input = document.getElementById('checkUrl');
    var out = document.getElementById('checkOut');
    var btn = document.getElementById('checkBtn');

    function render(d) {
      var color = d.score >= 75 ? 'text-emerald-400' : d.score >= 60 ? 'text-amber-400' : 'text-red-400';
      var bots = d.aiReadiness.blocksAiBots ? L.blocks + ' ' + esc(d.aiReadiness.blockedBots.join(', ')) : L.notBlocked;
      var host = hostOf(d.url);
      var link = PAGE + '?url=' + encodeURIComponent(host);
      var shareText = host + ' ' + L.shareText.replace('{score}', d.score) + ' ' + link;
      var html =
        '<p class="text-sm text-slate-400 mb-1">' + esc(host) + '</p>' +
        '<div class="flex items-baseline gap-4 mb-4"><span class="text-6xl font-extrabold ' + color + '">' + d.score + '</span>' +
        '<span class="text-slate-400">/ 100 · ' + L.grade + ' <b class="text-white">' + esc(d.grade) + '</b> · ' + d.issuesCount + ' ' + L.issues + '</span></div>' +
        '<div class="grid sm:grid-cols-2 gap-3 mb-4 text-sm">' +
        '<div class="bg-slate-950 rounded-lg p-3">/llms.txt: <b>' + (d.aiReadiness.hasLlmsTxt ? L.found : L.missing) + '</b></div>' +
        '<div class="bg-slate-950 rounded-lg p-3">' + L.bots + ': <b>' + bots + '</b></div></div>' +
        '<ul class="space-y-2 mb-4">' + d.topIssues.map(function (i) {
          return '<li class="text-sm"><span class="uppercase text-xs font-bold ' + (sevColor[i.severity] || '') + '">' + esc(L.sev[i.severity] || i.severity) + '</span> ' +
            '<span class="text-slate-400">' + esc(trCat(i.category)) + ':</span> ' + esc(trMsg(i.message)) + '</li>';
        }).join('') + '</ul>' +
        (d.hiddenIssues > 0 ? '<p class="text-sm text-slate-300 mb-4">+ ' + d.hiddenIssues + ' ' + L.more + '</p>' : '');
      if (CONTACT_URL) {
        html += '<div class="bg-emerald-950/40 border border-emerald-600/40 rounded-lg p-4 mb-4">' +
          '<p class="font-semibold text-white mb-1">' + L.serviceTitle + '</p>' +
          '<p class="text-sm text-slate-300 mb-3">' + L.serviceText + '</p>' +
          '<a class="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2 rounded-lg" target="_blank" rel="noopener" href="' + esc(CONTACT_URL) + '">' + L.serviceCta + '</a></div>';
      }
      html += '<a class="inline-block text-sm text-blue-400 underline mb-4" target="_blank" rel="noopener" href="' + esc(d.fullReportUrl) + '">' + L.devCta + '</a>' +
        '<div class="border-t border-slate-800 pt-4"><p class="text-sm text-slate-400 mb-2">' + L.share + '</p>' +
        '<div class="flex flex-wrap gap-2">' +
        '<a class="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-lg" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(shareText) + '">' + L.whatsapp + '</a>' +
        '<a class="bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2 rounded-lg" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '">X</a>' +
        '<button id="copyBtn" type="button" class="bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">' + L.copy + '</button>' +
        '</div></div>' +
        '<p class="text-xs text-slate-500 mt-3">' + d.freeChecksRemainingToday + ' ' + L.left + '</p>';
      out.innerHTML = html;
      document.getElementById('copyBtn').addEventListener('click', function () {
        var b = this;
        (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { b.textContent = L.copied; }, function () { window.prompt(L.copy, link); });
      });
      try { history.replaceState(null, '', '?url=' + encodeURIComponent(host)); } catch (e) {}
    }

    function run(url) {
      if (!url) return;
      btn.disabled = true; btn.textContent = L.checking;
      out.classList.remove('hidden');
      out.innerHTML = '<p class="text-sm text-slate-400">' + L.analyzing + ' ' + esc(url) + '…</p>';
      fetch('/api/public/check?url=' + encodeURIComponent(url)).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.success) {
          out.innerHTML = '<p class="text-sm text-red-400">' + esc(d.error || L.failed) + '</p>' +
            (d.upgradeUrl ? '<a class="text-sm text-emerald-400 underline" target="_blank" rel="noopener" href="' + esc(d.upgradeUrl) + '">' + L.moreChecks + '</a>' : '');
          return;
        }
        render(d);
      }).catch(function () {
        out.innerHTML = '<p class="text-sm text-red-400">' + L.netError + '</p>';
      }).then(function () { btn.disabled = false; btn.textContent = L.button; });
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); run(input.value.trim()); });
    var preset = new URLSearchParams(location.search).get('url');
    if (preset) { input.value = preset; run(preset); }
  </script>
</body>
</html>`;

function safeContactUrl(raw) {
  const v = String(raw || '').trim();
  return /^(https:\/\/|mailto:)/i.test(v) ? v : '';
}

/** Embeds JSON safely inside an inline <script>. */
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderLanding(lang = 'en', env = process.env) {
  const l = lang === 'es' ? 'es' : 'en';
  const vars = {
    ...TEXT[l],
    lang: l,
    site: SITE,
    rapidapi: RAPIDAPI,
    clientJson: scriptJson(CLIENT[l]),
    contactJson: scriptJson(safeContactUrl(env.CONTACT_URL))
  };
  return TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}
