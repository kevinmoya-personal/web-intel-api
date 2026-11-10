/**
 * Private, client-ready audit report in Spanish (the deliverable of the paid service).
 *
 *   GET  /informe  -> small form (URL + access key)
 *   POST /informe  -> { url, key, cliente? }  returns a printable HTML report
 *
 * Protected by the REPORT_KEY environment variable (never in the URL). Without it the
 * endpoint is disabled, so the full report is never public.
 */

import { timingSafeEqual } from 'node:crypto';
import { fetchTargetPage, parseHtmlMetadata, checkAiReadiness, computeAuditReport, detectTechAndContacts } from './analyzer.mjs';
import { auditHttpSecurityHeaders } from './catalog-apis.mjs';
import { clientIp } from './public-check.mjs';

const CONTACT = { name: 'Kevin Moya', whatsapp: '+57 311 242 2826', email: 'Danielmoya07@outlook.com', site: 'web-intel-api.vercel.app/es' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- wrong-key limiter (per warm instance) ---
const attempts = new Map();
const MAX_BAD_ATTEMPTS = 10;
function badAttempt(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const rec = attempts.get(ip);
  const cur = rec && rec.day === day ? rec : { day, count: 0 };
  cur.count += 1;
  attempts.set(ip, cur);
  if (attempts.size > 5000) attempts.clear();
}
function isLocked(ip) {
  const rec = attempts.get(ip);
  return Boolean(rec && rec.day === new Date().toISOString().slice(0, 10) && rec.count >= MAX_BAD_ATTEMPTS);
}
export function _resetReportAttempts() { attempts.clear(); }

function keyMatches(given, expected) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Each rule: what is wrong, why it matters for the business, how to fix it (with snippet). */
const RULES = [
  { rx: /^Missing <title> tag\.$/, t: 'La página no tiene título',
    why: 'El título es lo primero que leen Google y las IA para saber de qué trata la página. Sin él, es muy difícil que la muestren o la recomienden.',
    fix: 'Agregar dentro de <head> un título de 15 a 70 caracteres con el nombre del negocio y lo que ofrece.',
    code: '<title>Nombre del negocio – Qué ofrece en Ciudad</title>' },
  { rx: /^Title length \((\d+) chars\).*$/, t: 'El título tiene $1 caracteres (ideal: 15 a 70)',
    why: 'Un título muy corto no explica el negocio; uno muy largo se corta en los resultados.',
    fix: 'Reescribir el título entre 15 y 70 caracteres: nombre + servicio principal + ciudad.',
    code: '<title>Nombre del negocio – Servicio principal en Ciudad</title>' },
  { rx: /^Missing meta description\.$/, t: 'Falta la descripción de la página',
    why: 'Es el resumen que Google muestra bajo el título y que las IA usan para describir el negocio. Sin ella, inventan el resumen o lo omiten.',
    fix: 'Agregar una descripción de 50 a 160 caracteres que diga qué ofrece el negocio, a quién y dónde.',
    code: '<meta name="description" content="Qué ofrece el negocio, para quién y en qué ciudad. Incluye el beneficio principal.">' },
  { rx: /^Meta description length \((\d+) chars\).*$/, t: 'La descripción tiene $1 caracteres (ideal: 50 a 160)',
    why: 'Fuera de ese rango se corta o resulta demasiado pobre para que buscadores e IA la usen.',
    fix: 'Ajustar la descripción a entre 50 y 160 caracteres.',
    code: '<meta name="description" content="Resumen claro de 50 a 160 caracteres.">' },
  { rx: /^No <h1> heading found on the page\.$/, t: 'No hay encabezado principal (H1)',
    why: 'El H1 le dice a buscadores e IA cuál es el tema central de la página. Sin él, les cuesta entender de qué trata.',
    fix: 'Agregar un único H1 visible al inicio del contenido con la frase que mejor describe la página.',
    code: '<h1>Servicio principal del negocio en Ciudad</h1>' },
  { rx: /^Multiple <h1> tags found \((\d+)\).*$/, t: 'Hay $1 encabezados principales (H1)',
    why: 'Varios H1 confunden sobre cuál es el tema central de la página.',
    fix: 'Dejar un solo H1 y convertir los demás en H2 o H3.',
    code: '<h1>Tema central</h1>\n<h2>Sección 1</h2>\n<h2>Sección 2</h2>' },
  { rx: /^Missing rel="canonical" link tag\.$/, t: 'Falta la etiqueta canonical',
    why: 'Indica cuál es la dirección oficial de la página. Sin ella, versiones duplicadas (con www, sin www, con parámetros) compiten entre sí.',
    fix: 'Agregar en <head> la etiqueta canonical con la dirección oficial de cada página.',
    code: '<link rel="canonical" href="https://www.tunegocio.com/pagina">' },
  { rx: /^Incomplete OpenGraph tags.*$/, t: 'Faltan etiquetas para compartir en redes',
    why: 'Cuando alguien comparte el enlace en WhatsApp o Facebook, sale sin imagen ni título atractivo y recibe menos clics.',
    fix: 'Agregar las etiquetas OpenGraph con título, descripción e imagen (1200×630 px).',
    code: '<meta property="og:title" content="Título para redes">\n<meta property="og:description" content="Descripción breve">\n<meta property="og:image" content="https://www.tunegocio.com/imagen-1200x630.jpg">' },
  { rx: /^(\d+) of (\d+) images are missing alt attributes\.$/, t: '$1 de $2 imágenes no tienen texto alternativo',
    why: 'Las IA y los buscadores no "ven" las imágenes: leen ese texto. Sin él, ignoran lo que muestran tus productos o servicios. También afecta la accesibilidad.',
    fix: 'Agregar a cada imagen un atributo alt que describa lo que muestra.',
    code: '<img src="producto.jpg" alt="Descripción breve de lo que muestra la imagen">' },
  { rx: /^No JSON-LD.*$/, t: 'No hay datos estructurados (ficha del negocio para IA)',
    why: 'Es la forma más directa de decirle a las IA y a Google qué es el negocio, dónde queda y cómo contactarlo. Es de lo que más pesa para aparecer en respuestas de IA.',
    fix: 'Agregar en <head> un bloque JSON-LD con los datos del negocio (ajustar el tipo: LocalBusiness, Restaurant, Store, etc.).',
    code: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "LocalBusiness",\n  "name": "Nombre del negocio",\n  "description": "Qué ofrece",\n  "url": "https://www.tunegocio.com",\n  "telephone": "+57 300 000 0000",\n  "address": { "@type": "PostalAddress", "addressLocality": "Ciudad", "addressCountry": "CO" }\n}\n</script>' },
  { rx: /^No \/llms\.txt file found.*$/, t: 'No existe el archivo /llms.txt',
    why: 'Es un archivo nuevo que resume el sitio para los agentes de IA. Aún no es un estándar obligatorio, pero es barato de crear y ayuda a que entiendan el negocio.',
    fix: 'Crear un archivo de texto llamado llms.txt en la raíz del sitio.',
    code: '# Nombre del negocio\n\n> Qué ofrece el negocio, para quién y dónde.\n\n## Páginas principales\n- [Servicios](https://www.tunegocio.com/servicios): descripción\n- [Contacto](https://www.tunegocio.com/contacto): teléfono, dirección y horario' },
  { rx: /^robots\.txt blocks AI crawlers: (.*)$/, t: 'El sitio bloquea a estas IA: $1',
    why: 'Si el archivo robots.txt les prohíbe el acceso, esas IA no pueden leer el sitio y no lo van a citar ni recomendar.',
    fix: 'Quitar del archivo robots.txt las reglas "Disallow" para esos robots (salvo que el bloqueo sea intencional).',
    code: 'User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /' },
  { rx: /^Missing Strict-Transport-Security.*$/, t: 'Falta la cabecera de seguridad HSTS',
    why: 'Obliga a que el sitio siempre cargue con conexión segura (https). Es una señal de confianza.',
    fix: 'Configurar en el servidor o hosting esta cabecera de respuesta.',
    code: 'Strict-Transport-Security: max-age=63072000; includeSubDomains' }
];

const SEV = { high: ['Alta', '#b91c1c'], medium: ['Media', '#b45309'], low: ['Baja', '#0369a1'], info: ['Info', '#475569'] };
const SEV_RANK = { high: 0, medium: 1, low: 2, info: 3 };

const PASSED_ES = [
  [/^Optimal <title> length$/, 'Título con longitud adecuada'],
  [/^Optimal meta description$/, 'Descripción con longitud adecuada'],
  [/^Single clear <h1> heading present$/, 'Un único encabezado principal (H1)'],
  [/^Canonical URL defined$/, 'Dirección canonical definida'],
  [/^Complete OpenGraph social tags$/, 'Etiquetas para compartir en redes completas'],
  [/^All images include alt text$/, 'Todas las imágenes tienen texto alternativo'],
  [/^JSON-LD structured data detected \((.*)\)$/, 'Datos estructurados detectados ($1)'],
  [/^\/llms\.txt file available for AI crawlers$/, 'Archivo /llms.txt disponible'],
  [/^HSTS security header active$/, 'Cabecera de seguridad HSTS activa']
];
export function translatePassed(text) {
  for (const [rx, es] of PASSED_ES) if (rx.test(text)) return text.replace(rx, es);
  return text;
}

export function explainIssue(issue) {
  // Blocking AI crawlers is the most damaging finding for AI visibility
  if (/^robots\.txt blocks AI crawlers/.test(issue.message)) issue = { ...issue, severity: 'high' };
  for (const r of RULES) {
    const m = issue.message.match(r.rx);
    if (m) {
      const sub = s => s.replace(/\$(\d)/g, (_, n) => m[Number(n)] ?? '');
      return { severity: issue.severity, title: sub(r.t), why: r.why, fix: r.fix, code: r.code };
    }
  }
  return { severity: issue.severity, title: issue.message, why: '', fix: '', code: '' };
}

export async function buildReportData(targetUrl) {
  const pageData = await fetchTargetPage(targetUrl);
  const meta = parseHtmlMetadata(pageData.html, pageData.finalUrl);
  const aiReadiness = await checkAiReadiness(pageData.origin);
  const audit = computeAuditReport(pageData, meta, aiReadiness);
  const tech = detectTechAndContacts(pageData);
  let security = null;
  try { security = await auditHttpSecurityHeaders(pageData.finalUrl); } catch { /* optional section */ }
  return {
    url: pageData.finalUrl,
    hostname: pageData.hostname,
    date: new Date().toISOString().slice(0, 10),
    score: audit.overallScore,
    grade: audit.grade,
    responseTimeMs: audit.responseTimeMs,
    issues: audit.issues.map(explainIssue).sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9)),
    passed: (audit.passedChecks || []).map(translatePassed),
    ai: { hasLlmsTxt: Boolean(aiReadiness.hasLlmsTxt), blockedBots: aiReadiness.blockedBots || [] },
    technologies: tech.technologies || [],
    security: security ? { grade: security.grade, score: security.score, missing: (security.missingHeaders || []).map(h => h.header) } : null,
    title: meta.title || '',
    looksJsRendered: !meta.title && meta.headings.h1.length === 0 && pageData.html.length < 6000
  };
}

const CSS = `body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:820px;margin:0 auto;padding:32px 24px;line-height:1.5}
h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:32px 0 10px;border-bottom:2px solid #e2e8f0;padding-bottom:6px}
.muted{color:#64748b;font-size:13px}.score{display:flex;align-items:center;gap:20px;background:#f1f5f9;border-radius:12px;padding:18px 22px;margin:20px 0}
.num{font-size:56px;font-weight:800}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:14px}
.issue{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:12px 0;page-break-inside:avoid}.issue h3{margin:0 0 6px;font-size:16px}
.tag{display:inline-block;color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:2px 9px;margin-right:8px;vertical-align:middle}
pre{background:#0f172a;color:#e2e8f0;border-radius:8px;padding:10px 12px;font-size:12px;white-space:pre-wrap;word-break:break-word}
.note{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;font-size:13px}
.btn{background:#059669;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer}
footer{margin-top:36px;border-top:1px solid #e2e8f0;padding-top:14px;font-size:13px;color:#475569}
@media print{.noprint{display:none}body{padding:0}}`;

export function renderReport(d, cliente = '') {
  const color = d.score >= 75 ? '#059669' : d.score >= 60 ? '#b45309' : '#b91c1c';
  const counts = { high: 0, medium: 0, low: 0, info: 0 };
  d.issues.forEach(i => { counts[i.severity] = (counts[i.severity] || 0) + 1; });
  const issuesHtml = d.issues.map((i, n) => {
    const [label, c] = SEV[i.severity] || SEV.info;
    return `<div class="issue"><h3><span class="tag" style="background:${c}">Prioridad ${label}</span>${n + 1}. ${esc(i.title)}</h3>` +
      (i.why ? `<p><b>Por qué importa:</b> ${esc(i.why)}</p>` : '') +
      (i.fix ? `<p><b>Cómo corregirlo:</b> ${esc(i.fix)}</p>` : '') +
      (i.code ? `<pre>${esc(i.code)}</pre>` : '') + '</div>';
  }).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Informe de visibilidad en IA – ${esc(d.hostname)}</title><style>${CSS}</style></head><body>
<p class="noprint"><button class="btn" onclick="window.print()">Guardar como PDF / Imprimir</button></p>
<h1>Informe de visibilidad en buscadores de IA</h1>
<p class="muted">${cliente ? 'Preparado para: <b>' + esc(cliente) + '</b> · ' : ''}Sitio: <b>${esc(d.url)}</b> · Fecha: ${esc(d.date)} · Preparado por ${esc(CONTACT.name)}</p>
<div class="score"><div class="num" style="color:${color}">${d.score}</div><div><b>Puntaje sobre 100 · Nota ${esc(d.grade)}</b><br>
<span class="muted">${d.issues.length} problemas encontrados: ${counts.high} de prioridad alta, ${counts.medium} media, ${counts.low + counts.info} baja.</span></div></div>
<p>Este informe mide qué tan fácil es para ChatGPT, Perplexity, la IA de Google y los buscadores tradicionales <b>leer y entender</b> el sitio. Un buen puntaje permite que la IA lea la página; no garantiza por sí solo que la recomiende.</p>
${d.looksJsRendered ? '<p class="note"><b>Nota:</b> el sitio parece cargar su contenido con JavaScript. La mayoría de robots de IA no ejecutan JavaScript, así que ven la página casi vacía. Esto explica buena parte del puntaje y conviene confirmarlo con el desarrollador del sitio.</p>' : ''}
<h2>Resumen de acceso para IA</h2>
<div class="grid">
<div class="box">Robots de IA bloqueados: <b>${d.ai.blockedBots.length ? esc(d.ai.blockedBots.join(', ')) : 'ninguno'}</b></div>
<div class="box">Archivo /llms.txt: <b>${d.ai.hasLlmsTxt ? 'existe' : 'no existe'}</b></div>
<div class="box">Tiempo de respuesta: <b>${esc(d.responseTimeMs)} ms</b></div>
<div class="box">Seguridad (cabeceras): <b>${d.security ? 'nota ' + esc(d.security.grade) + ' (' + esc(d.security.score) + '/100)' : 'no evaluada'}</b></div>
</div>
<h2>Problemas y cómo corregirlos (en orden de prioridad)</h2>
${issuesHtml || '<p>No se encontraron problemas en las revisiones realizadas.</p>'}
${d.security && d.security.missing.length ? `<h2>Seguridad del sitio</h2><p>Faltan estas cabeceras de seguridad, que se configuran en el servidor o el hosting: <b>${esc(d.security.missing.join(', '))}</b>. No afectan directamente la visibilidad en IA, pero sí la confianza y la protección del sitio.</p>` : ''}
${d.passed.length ? `<h2>Lo que ya está bien</h2><ul>${d.passed.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
${d.technologies.length ? `<h2>Tecnologías detectadas</h2><p>${esc(d.technologies.join(', '))}</p>` : ''}
<h2>Alcance de la revisión</h2>
<p class="muted">Se analizó el HTML inicial de la página indicada (no el contenido que carga después con JavaScript) y los archivos robots.txt y llms.txt del dominio. No incluye revisión de contenido, enlaces externos ni posicionamiento por palabras clave.</p>
<footer><b>${esc(CONTACT.name)}</b> · WhatsApp ${esc(CONTACT.whatsapp)} · ${esc(CONTACT.email)} · ${esc(CONTACT.site)}</footer>
</body></html>`;
}

const FORM_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Generar informe</title><style>${CSS} input{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin:4px 0 14px;font-size:15px;box-sizing:border-box}</style></head><body>
<h1>Generar informe para cliente</h1><p class="muted">Uso privado. Escribe el sitio del cliente y tu clave.</p>
<form id="f"><label>Sitio web del cliente<input id="u" required placeholder="https://cliente.com"></label>
<label>Nombre del cliente (opcional)<input id="c" placeholder="Panadería La Espiga"></label>
<label>Clave<input id="k" type="password" required autocomplete="current-password"></label>
<button class="btn" id="b">Generar informe</button></form><p id="m" class="note" style="display:none"></p>
<script>
document.getElementById('f').addEventListener('submit', function (e) {
  e.preventDefault();
  var b = document.getElementById('b'), m = document.getElementById('m');
  b.disabled = true; b.textContent = 'Generando…'; m.style.display = 'none';
  fetch('/informe', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: document.getElementById('u').value.trim(), cliente: document.getElementById('c').value.trim(), key: document.getElementById('k').value }) })
  .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, t: t }; }); })
  .then(function (x) {
    if (x.ok) { document.open(); document.write(x.t); document.close(); return; }
    var msg = 'No se pudo generar el informe.'; try { msg = JSON.parse(x.t).error || msg; } catch (e) {}
    m.textContent = msg; m.style.display = 'block'; b.disabled = false; b.textContent = 'Generar informe';
  }).catch(function () { m.textContent = 'Error de red.'; m.style.display = 'block'; b.disabled = false; b.textContent = 'Generar informe'; });
});
</script></body></html>`;

const html = (status, text) => ({ status, contentType: 'text/html; charset=utf-8', text });
const fail = (status, error) => ({ status, body: { success: false, error } });

export async function handleReport(method, body = {}, headers = {}, env = process.env, build = buildReportData) {
  if (method === 'GET') return html(200, FORM_HTML);
  if (method !== 'POST') return fail(405, 'Método no permitido.');

  const expected = String(env.REPORT_KEY || '').trim();
  if (!expected) return fail(503, 'El generador de informes no está activado: falta la variable REPORT_KEY en el servidor.');

  const ip = clientIp(headers);
  if (isLocked(ip)) return fail(429, 'Demasiados intentos con clave incorrecta. Intenta mañana.');
  if (!keyMatches(body?.key, expected)) {
    badAttempt(ip);
    return fail(403, 'Clave incorrecta.');
  }
  if (!body?.url) return fail(400, 'Falta el sitio web.');

  try {
    const data = await build(body.url);
    return html(200, renderReport(data, String(body.cliente || '').slice(0, 120)));
  } catch (err) {
    return fail(502, 'No se pudo analizar ese sitio: ' + (err.message || 'error desconocido'));
  }
}
