// Alex 202384014054
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const walk = (d) => readdirSync(join(root, d)).flatMap((f) => {
  const p = `${d}/${f}`;
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

test('index.html loads nothing from the network', () => {
  const html = read('index.html').replace(/xmlns(:\w+)?="http:\/\/www\.w3\.org[^"]*"/g, '');
  assert.ok(!/https?:\/\//.test(html), `external URL in index.html: ${html.match(/https?:\/\/[^\s"')]+/)?.[0]}`);
});

test('every three/addons import resolves to a vendored file', () => {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    assert.ok(existsSync(file), `missing vendored file ${file}`);
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)) visit(resolve(dirname(file), spec));
  };
  for (const f of walk('src').filter((p) => p.endsWith('.js'))) {
    for (const [, sub] of read(f).matchAll(/from\s+'three\/addons\/([^']+)'/g)) visit(join(root, 'vendor/three/examples/jsm', sub));
  }
  assert.ok(seen.size > 0, 'no addon imports found');
});

test('three core is vendored', () => {
  const core = join(root, 'vendor/three/build/three.module.js');
  assert.ok(existsSync(core), 'vendor/three/build/three.module.js missing');
  assert.match(readFileSync(core, 'utf8'), /REVISION = '170'/);
});
