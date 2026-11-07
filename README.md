# 🚀 Web2Agent & SEO/GEO Intelligence API (Micro-SaaS para RapidAPI)

API Serverless de **costo $0 de infraestructura** y **100% de margen bruto**, diseñada para monetizarse mediante suscripciones mensuales en **RapidAPI Hub**.

## 💡 Qué problemas resuelve (Por qué pagan los desarrolladores)
1. **Agentes de IA y Automatizaciones (Make, n8n, Zapier, LangChain):** Necesitan convertir páginas web en **Markdown limpio** sin basura HTML, calculando automáticamente el conteo de palabras y tokens para LLMs (`/api/v1/extract`).
2. **Herramientas SEO y GEO (Generative Engine Optimization):** Audita etiquetas SEO clásicas junto con la preparación para motores de IA (`/llms.txt`, `JSON-LD`, bloqueos de `GPTBot`/`ClaudeBot` en `robots.txt`) devolviendo un puntaje de `0 a 100` (`/api/v1/audit`).
3. **Enriquecimiento de Leads B2B:** Detecta el stack tecnológico de cualquier empresa (Shopify, Next.js, Stripe, WordPress, HubSpot, Cloudflare, etc.) y extrae correos y perfiles de redes sociales públicos (`/api/v1/tech-stack`).

---

## 🛠️ Endpoints Incluidos
- `GET /api/v1/health` — Estado del servicio.
- `GET /api/v1/extract?url=https://...` — Extractor de Markdown limpio para IA + conteo de tokens + metadatos OpenGraph.
- `GET /api/v1/audit?url=https://...` — Auditoría técnica SEO + AI-Readiness (GEO Score 0–100).
- `GET /api/v1/tech-stack?url=https://...` — Detector de tecnologías y contactos B2B.
- `GET /api/v1/full-report?url=https://...` — Reporte 3-en-1 completo.

---

## 🚀 Paso a Paso para Publicar y Monetizar (10 minutos)

### Paso 1: Subir a GitHub y Desplegar Gratis en Vercel
1. Sube esta carpeta (`web-intel-api`) a un repositorio en tu cuenta de GitHub (`kevinmoya-personal`).
2. Entra a [https://vercel.com](https://vercel.com) con tu cuenta de GitHub y haz clic en **"Add New..." -> "Project"**.
3. Importa el repositorio `web-intel-api` y dale a **"Deploy"**.
4. Obtendrás tu URL de producción gratuita (ej. `https://web-intel-api.vercel.app`).

### Paso 2: Publicar en RapidAPI Studio y Configurar Precios
1. Entra a [https://rapidapi.com/studio](https://rapidapi.com/studio) (inicia sesión con tu cuenta de GitHub).
2. Haz clic en **"Add API Project"**:
   - **Name:** `Web2Agent Clean Markdown & SEO GEO Auditor`
   - **Category:** `Data` o `Tools`
   - **Import:** Selecciona **OpenAPI** y sube el archivo [`openapi.json`](./openapi.json) incluido en esta carpeta (esto creará los 4 endpoints y su documentación automáticamente).
3. En la pestaña **Hub Listing -> Gateway / Base URL**, pega tu URL de Vercel (`https://tu-proyecto.vercel.app`).
4. *(Opcional pero recomendado)* Copia el `X-RapidAPI-Proxy-Secret` que te da RapidAPI y agrégalo en Vercel -> Settings -> Environment Variables como `RAPIDAPI_PROXY_SECRET`.
5. En la pestaña **Monetize / Plans**, configura los 4 niveles estándar que mejor convierten:
   - **BASIC (Gratis):** `$0.00 / mes` — Límite: `50 peticiones / mes` (para que los desarrolladores la prueben gratis).
   - **PRO:** `$9.99 / mes` — Límite: `5,000 peticiones / mes` (`+$0.003` por petición extra).
   - **ULTRA:** `$29.99 / mes` — Límite: `25,000 peticiones / mes`.
   - **MEGA:** `$79.99 / mes` — Límite: `100,000 peticiones / mes`.
6. Conecta tu cuenta de **PayPal o Stripe** en la sección de Payouts de RapidAPI y cambia la visibilidad de la API a **Public**.
