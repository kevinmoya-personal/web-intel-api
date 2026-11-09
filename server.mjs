#!/usr/bin/env node
/**
 * Standalone HTTP Server for Web2Agent & SEO/GEO Intelligence API
 * (Used when running locally via `npm start` or on container platforms like Render/Railway)
 *
 * Reuses the exact Vercel handler through a tiny Express-style response shim, so local
 * behaviour (landing page, MCP, llms.txt, auth) matches production.
 */

import http from 'node:http';
import handler from './api/index.mjs';

const PORT = process.env.PORT || 3000;

function shimResponse(res) {
  let statusCode = 200;
  const api = {
    setHeader: (k, v) => { res.setHeader(k, v); return api; },
    status: code => { statusCode = code; return api; },
    json: obj => {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(statusCode);
      res.end(JSON.stringify(obj, null, 2));
      return api;
    },
    send: body => {
      res.writeHead(statusCode);
      res.end(body);
      return api;
    },
    end: () => {
      res.writeHead(statusCode);
      res.end();
      return api;
    }
  };
  return api;
}

const server = http.createServer(async (req, res) => {
  let bodyStr = '';
  for await (const chunk of req) bodyStr += chunk;

  let body = {};
  if (bodyStr) {
    try {
      body = JSON.parse(bodyStr);
    } catch {
      body = bodyStr; // MCP handler answers with a JSON-RPC parse error
    }
  }

  const reqShim = { url: req.url, method: req.method, headers: req.headers, body };
  try {
    await handler(reqShim, shimResponse(res));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Web2Agent & SEO/GEO Intelligence API listening on http://localhost:${PORT}`);
});
