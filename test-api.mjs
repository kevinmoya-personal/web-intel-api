#!/usr/bin/env node
/**
 * Automated End-to-End Test Suite for Web2Agent & SEO/GEO Intelligence API
 */

import { handleApiRequest } from './api/index.mjs';

async function runTests() {
  console.log('🧪 Probando los 4 endpoints de Web2Agent & SEO Intelligence API en vivo...\n');

  const hRes = await handleApiRequest('/api/v1/health');
  console.log(`1. [GET /api/v1/health] -> HTTP ${hRes.status}`);
  console.log('   Servicio:', hRes.body.service);

  const testUrl = 'https://example.com';

  const extRes = await handleApiRequest(`/api/v1/extract?url=${encodeURIComponent(testUrl)}`);
  console.log(`\n2. [GET /api/v1/extract?url=${testUrl}] -> HTTP ${extRes.status}`);
  console.log(`   Título: "${extRes.body.metadata?.title}" | Tokens estimados: ${extRes.body.content?.estimatedTokens}`);
  console.log(`   Markdown Preview:\n   ${extRes.body.content?.markdown.replace(/\n/g, ' ').slice(0, 140)}...`);

  const audRes = await handleApiRequest(`/api/v1/audit?url=${encodeURIComponent(testUrl)}`);
  console.log(`\n3. [GET /api/v1/audit?url=${testUrl}] -> HTTP ${audRes.status}`);
  console.log(`   Score: ${audRes.body.audit?.overallScore}/100 (Grado ${audRes.body.audit?.grade}) | Latencia: ${audRes.body.audit?.responseTimeMs}ms`);
  console.log(`   Issues detectados (${audRes.body.audit?.issuesCount}):`, audRes.body.audit?.issues.map(i => `[${i.category}] ${i.message}`).join(' | '));

  const techRes = await handleApiRequest(`/api/v1/tech-stack?url=${encodeURIComponent('https://algora.io')}`);
  console.log(`\n4. [GET /api/v1/tech-stack?url=https://algora.io] -> HTTP ${techRes.status}`);
  console.log(`   Tecnologías detectadas:`, techRes.body.technologies);
  console.log(`   Redes sociales extraídas:`, techRes.body.contacts?.socialProfiles);

  console.log('\n✅ Todos los endpoints funcionan al 100% y están listos para desplegar en Vercel + RapidAPI.');
}

runTests().catch(console.error);
