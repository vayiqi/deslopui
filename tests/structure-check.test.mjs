import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { check, summarise, parseArgs, loadPlaywright } from '../deslop-ui/scripts/structure-check.mjs';

const fx = name => pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', name)).href;
let browser, page;
before(async () => { browser = await (await loadPlaywright()).chromium.launch(); page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); });
after(async () => { await browser?.close(); });
const run = async name => { await page.goto(fx(name)); return summarise(await page.evaluate(check), false); };

test('a clean page passes the Floor with no structural hits', async () => {
  const r = await run('clean.html');
  assert.deepEqual(r.floor, []);
  for (const k of ['controlInControl', 'boxInBox', 'pillInPill', 'sideStripes', 'dividers', 'middleDots', 'lowContrast']) assert.equal(r[k].count, 0, k);
  assert.equal(r.contrastUnknown, 0);
});

test('a sloppy page shows every pattern once', async () => {
  const r = await run('sloppy.html');
  assert.deepEqual(r.controlInControl.hits, ['a.row > button "Go"']);
  assert.deepEqual(r.boxInBox.hits, ['div.card > div.inner "Nested"']);
  assert.deepEqual(r.pillInPill.hits, ['div.track > span.chip "On"']);
  assert.deepEqual(r.sideStripes.hits, ['div.stripe border-left "Warning"']);
  assert.equal(r.dividers.count, 2, 'a 1px rule and an <hr>');
  assert.equal(r.tinyCaps.count, 1);
  assert.equal(r.smallText.count, 1);
  assert.equal(r.middleDots.count, 1);
  assert.equal(r.lowContrast.count, 1);
  assert.equal(r.contrastUnknown, 1, 'text over an image is not guessed');
  assert.ok(!r.smallTargets.hits.some(h => h.includes('"terms"')), 'a link inside a sentence is exempt');
  assert.ok(r.smallTargets.hits.some(h => h.startsWith('a.small 20x20')));
  assert.deepEqual(r.floor, ['controlInControl', 'lowContrast', 'smallText', 'tinyCaps', 'smallTargets']);
});

test('contrast uses the dark canvas, opacity and what is painted behind', async () => {
  const r = await run('dark.html');
  assert.equal(r.lowContrast.count, 3);
  assert.ok(!r.lowContrast.hits.some(h => h.includes('Light text on a dark canvas')));
  assert.ok(r.lowContrast.hits.some(h => h.includes('Faded by opacity')));
  assert.ok(r.lowContrast.hits.some(h => h.includes('Light on white sibling')));
});

test('repeated hits are kept with a count', async () => {
  await page.setContent('<style>i{display:inline-block;width:1px;height:20px;background:#999;margin:4px}</style><div><i></i><i></i><i></i></div>');
  const r = summarise(await page.evaluate(check), false);
  assert.equal(r.dividers.count, 3);
  assert.equal(r.dividers.hits.length, 1);
  assert.match(r.dividers.hits[0], / x3$/);
});

test('arguments are validated', () => {
  assert.equal(parseArgs(['--phone', 'https://a.test']).url, 'https://a.test');
  assert.deepEqual(parseArgs(['https://a.test', '--click', '#a', '--click', '#b']).clicks, ['#a', '#b']);
  assert.deepEqual(parseArgs(['https://a.test', '--units', 'NAV, CARD']).units, ['NAV', 'CARD']);
  assert.throws(() => parseArgs([]), /URL/);
  assert.throws(() => parseArgs(['example.com']), /http/);
  assert.throws(() => parseArgs(['https://a.test', '--wait']), /needs a value/);
  assert.throws(() => parseArgs(['https://a.test', '--wait', 'soon']), /number/);
  assert.throws(() => parseArgs(['https://a.test', '--bogus']), /Unknown/);
});
