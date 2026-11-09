import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHtmlMetadata } from '../lib/analyzer.mjs';

test('reads quoted attributes (classic HTML)', () => {
  const html = `<html lang="es"><head><title>Hola</title>
    <meta name="description" content="Una descripción">
    <meta property='og:title' content='OG Title'>
    <link rel="canonical" href="https://a.com/x">
    <script type="application/ld+json">{"@type":"Organization"}</script></head>
    <body><h1>Hola</h1><img src="a.png" alt="logo"><img src="b.png">
    <a href="/about">About</a><a href="https://b.com">B</a><a href="#top">Top</a></body></html>`;
  const m = parseHtmlMetadata(html, 'https://a.com/');
  assert.equal(m.language, 'es');
  assert.equal(m.description, 'Una descripción');
  assert.equal(m.openGraph.title, 'OG Title');
  assert.equal(m.canonical, 'https://a.com/x');
  assert.equal(m.jsonLdCount, 1);
  assert.deepEqual(m.headings.h1, ['Hola']);
  assert.equal(m.images.total, 2);
  assert.equal(m.images.missingAlt, 1);
  assert.equal(m.links.internalCount, 1);
  assert.equal(m.links.externalCount, 1);
});

test('reads unquoted attributes (minified HTML)', () => {
  const html = `<!doctype html><html lang=en><head><meta charset=utf-8>
    <meta name=description content=Minified>
    <link href=https://a.com/c rel=canonical>
    <script type=application/ld+json>{"@type":"WebSite"}</script>
    <title>Example Domain</title></head><body><img src=x.png alt=hi><a href=/p>P</a></body></html>`;
  const m = parseHtmlMetadata(html, 'https://a.com/');
  assert.equal(m.language, 'en');
  assert.equal(m.description, 'Minified');
  assert.equal(m.canonical, 'https://a.com/c');
  assert.equal(m.jsonLdCount, 1);
  assert.equal(m.images.missingAlt, 0);
  assert.equal(m.links.internalCount, 1);
});
