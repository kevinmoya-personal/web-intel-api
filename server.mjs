#!/usr/bin/env node
/**
 * Standalone HTTP Server for Web2Agent & SEO/GEO Intelligence API
 * (Used when running locally via `npm start` or on container platforms like Render/Railway)
 */

import http from 'node:http';
import { handleApiRequest } from './api/index.mjs';

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RapidAPI-Key, X-RapidAPI-Host, X-RapidAPI-Proxy-Secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  let bodyStr = '';
  for await (const chunk of req) {
    bodyStr += chunk;
  }

  let bodyObj = {};
  if (bodyStr) {
    try {
      bodyObj = JSON.parse(bodyStr);
    } catch {
      // ignore non-JSON body
    }
  }

  const result = await handleApiRequest(req.url, req.method, bodyObj, req.headers);
  res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(result.body, null, 2));
});

server.listen(PORT, () => {
  console.log(`🚀 Web2Agent & SEO/GEO Intelligence API listening on http://localhost:${PORT}`);
});
