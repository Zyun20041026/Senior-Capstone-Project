// Alex 202384014054
'use strict';
// The English / Chinese switch: English by default, Chinese on request, and
// every piece of text on screen exists in both languages.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I18N = require('../js/i18n.js');
const Viruses = require('../js/viruses.js');
const Duel = require('../js/duel.js');

const ROOT = path.join(__dirname, '..');
const HAN = /[一-鿿]/;

test('English is the default; ?lang= picks a language and beats the saved one', () => {
  assert.strictEqual(I18N.pick('', null).lang, 'en');
  assert.strictEqual(I18N.pick('?level=3', null).lang, 'en');
  assert.strictEqual(I18N.pick('', 'zh').lang, 'zh');
  assert.strictEqual(I18N.pick('', 'fr').lang, 'en');
  assert.deepStrictEqual(I18N.pick('?lang=zh', null), { lang: 'zh', fromUrl: true });
  assert.strictEqual(I18N.pick('?duel=noro&lang=en', 'zh').lang, 'en');
  assert.strictEqual(I18N.pick('?lang=zhx', null).lang, 'en');
});

test('L() returns the text for the chosen language', () => {
  assert.strictEqual(I18N.make('en').L('Hint', '提示'), 'Hint');
  assert.strictEqual(I18N.make('zh').L('Hint', '提示'), '提示');
  assert.strictEqual(I18N.make('zh').zh, true);
  assert.strictEqual(I18N.make('xx').lang, 'en');
});

test('boot saves a language from the address and survives blocked storage', () => {
  const mem = {};
  const win = { location: { search: '?lang=zh' }, localStorage: { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } } };
  assert.strictEqual(I18N.boot(win).zh, true);
  assert.strictEqual(mem[I18N.KEY], 'zh');
  const blocked = { location: { search: '' }, get localStorage() { throw new Error('blocked'); } };
  assert.strictEqual(I18N.boot(blocked).lang, 'en');
});

test('index.html is English, with the Chinese kept in data-zh, and has the language button', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/<html lang="en">/.test(html));
  assert.ok(/data-act="lang"[^>]*>中文<\/button>/.test(html), 'the button offers Chinese');
  // outside the data-zh / data-zh-label / title attributes, no Chinese text is left
  const bare = html.replace(/\s(data-zh(-label)?|title)="[^"]*"/g, '').replace(/>中文</, '><');
  assert.ok(!HAN.test(bare), 'Chinese text outside data-zh: ' + (bare.match(/.{0,30}[一-鿿].{0,30}/) || [''])[0]);
  assert.ok((html.match(/data-zh="/g) || []).length >= 20);
});

test('every virus and upgrade has its English text', () => {
  for (const v of Viruses.LIST) {
    for (const key of ['name', 'formText', 'formShort', 'whereEn']) {
      assert.ok(typeof v[key] === 'string' && v[key].length > 1 && !HAN.test(v[key]), v.id + '.' + key);
    }
    assert.strictEqual(v.factsEn.length, 2, v.id);
    for (const f of v.factsEn) assert.ok(f.length >= 30 && f.length <= 160 && !HAN.test(f), v.id + ': ' + f);
    // the same content floor as the Chinese dossier
    assert.ok(!/mutation|sequence|genome|receptor|culture|amplif|[ACGU]{6,}/i.test(v.factsEn.join(' ')), v.id);
  }
  for (const u of Duel.UPGRADES) assert.ok(u.name && u.subEn && !HAN.test(u.name + u.subEn), u.id);
});

test('game.js carries both languages for the main words', () => {
  const game = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
  assert.ok(game.includes('const LANG = I18N, L = LANG.L, ZH = LANG.zh;'));
  for (const word of ['Normal protein', 'Resistant protein', 'Dose', 'Reading', 'Same rules as Minesweeper', 'Game data is made up', 'Hold the Cell Cluster']) {
    assert.ok(game.includes(word), word);
  }
  assert.ok(/name === 'lang'\) LANG\.toggle\(\)/.test(game), 'the language button works');
});
