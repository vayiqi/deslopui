#!/usr/bin/env node
// Structural check for UI slop. Opens a page in Chromium and reads the computed styles of everything visible at first view.
// Usage: node structure-check.mjs <url> [--phone] [--wait ms] [--click "selector"]... [--units A,B] [--out file.json] [--shot file.jpg]
// Needs Playwright with a Chromium build: npm i -D playwright && npx playwright install chromium

import { writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = 'Usage: node structure-check.mjs <url> [--phone] [--wait ms] [--click "selector"]... [--units A,B] [--out file.json] [--shot file.jpg]';

// Rules the script can measure without judgement. Any hit here blocks shipping (the Floor in SKILL.md).
export const FLOOR_KEYS = ['controlInControl', 'lowContrast', 'smallText', 'tinyCaps', 'smallTargets'];
// First-view budgets from SKILL.md. Reported, not Floor: the script cannot tell interface text from content.
export const BUDGET = { phone: { words: 25, controls: 5 }, desktop: { words: 40, controls: 7 } };

export function parseArgs(argv) {
  const takes = new Set(['--wait', '--click', '--out', '--shot', '--units']);
  const known = new Set([...takes, '--phone', '-h', '--help']);
  const o = { url: null, phone: false, wait: 3000, clicks: [], units: null, out: null, shot: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { o.help = true; continue; }
    if (a === '--phone') { o.phone = true; continue; }
    if (a.startsWith('-')) {
      if (!known.has(a)) throw new Error(`Unknown option ${a}`);
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && takes.has(a))) throw new Error(`${a} needs a value`);
      i++;
      if (a === '--wait') { o.wait = Number(v); if (!Number.isFinite(o.wait) || o.wait < 0) throw new Error('--wait needs a number of milliseconds'); }
      else if (a === '--click') o.clicks.push(v);
      else if (a === '--units') o.units = v.split(',').map(s => s.trim()).filter(Boolean);
      else if (a === '--out') o.out = v;
      else if (a === '--shot') o.shot = v;
      continue;
    }
    if (o.url) throw new Error(`Unexpected argument ${a}`);
    o.url = a;
  }
  if (o.help) return o;
  if (!o.url) throw new Error('Give a URL to check');
  if (!/^(https?|file):\/\//i.test(o.url)) throw new Error(`URL must start with http://, https:// or file:// (got ${o.url})`);
  return o;
}

// Finds Playwright next to this script, in the current project, or installed globally.
export async function loadPlaywright() {
  try { const m = await import('playwright'); return m.chromium ? m : m.default; } catch {}
  for (const base of [join(process.cwd(), 'noop.js'), import.meta.url]) {
    try { return createRequire(base)('playwright'); } catch {}
  }
  throw new Error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
}

// Runs inside the page. Must be self-contained: Playwright serialises it.
export const check = () => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > .05 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const nm = e => { const c = String(e.className?.baseVal ?? e.className ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${c.length ? '.' + c.join('.') : ''}`; };
  const tx = e => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const ctl = 'button,a[href],[role=button],input:not([type=hidden]),select,textarea,summary';
  const frame = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    const bg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent' || s.backgroundImage !== 'none';
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none');
    const sh = s.boxShadow !== 'none' && !/inset/.test(s.boxShadow), rad = parseFloat(s.borderRadius) || 0;
    return { framed: (bg && (rad > 0 || sh)) || sides.length === 4 || sh, sides, rad, w: r.width, h: r.height, bg }; };
  const rgba = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, base) => ({ r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1 });
  const opacity = e => { let o = 1; for (let p = e; p; p = p.parentElement) o *= +getComputedStyle(p).opacity; return o; };
  const root = getComputedStyle(document.documentElement);
  const canvas = /dark/.test(root.colorScheme) && !/light/.test(root.colorScheme) ? { r: 18, g: 18, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  const opaqueMedia = p => ['CANVAS', 'VIDEO', 'IMG', 'IFRAME', 'svg'].includes(p.tagName) || getComputedStyle(p).backgroundImage !== 'none';
  // What is painted behind the text: the hit-test stack under its centre, falling back to the ancestor chain.
  // Returns null when an image, gradient, canvas or video sits behind it.
  const backdrop = e => {
    const r = e.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
    const stack = document.elementsFromPoint(x, y), i = stack.indexOf(e);
    // Text that is not hit-testable (pointer-events: none) is missing from the stack: take everything painted at that point.
    const below = i > -1 ? stack.slice(i) : stack.length ? stack : [document.documentElement];
    const layers = [];
    for (const p of below) {
      if (p !== e && opaqueMedia(p)) return null;
      if (p === e && getComputedStyle(p).backgroundImage !== 'none') return null;
      const c = rgba(getComputedStyle(p).backgroundColor);
      if (c && c.a > 0) { const a = c.a * opacity(p); layers.push({ ...c, a }); if (a >= 1) break; }
    }
    let base = canvas; for (const c of layers.reverse()) base = blend(c, base); return base; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // WCAG 2.5.8 exempts a link inside a sentence: an inline link whose parent has text of its own.
  const inlineLink = e => e.tagName === 'A' && getComputedStyle(e).display === 'inline' && [...(e.parentElement?.childNodes || [])].some(n => n.nodeType === 3 && n.textContent.trim());

  const hits = { controlInControl: [], boxInBox: [], pillInPill: [], sideStripes: [], dividers: [], smallText: [], tinyCaps: [], middleDots: [], smallTargets: [], lowContrast: [] };
  const out = { words: 0, controls: 0, fontSizes: [], radii: [], contrastUnknown: 0 };
  const sizes = new Set(), radii = new Set();
  for (const e of [...document.querySelectorAll('body *')].filter(vis)) {
    const s = getComputedStyle(e), f = frame(e);
    if (f.rad) radii.add(s.borderRadius);
    if (e.matches(ctl)) {
      out.controls++;
      const p = e.parentElement?.closest(ctl); if (p && vis(p)) hits.controlInControl.push(`${nm(p)} > ${nm(e)} "${tx(e)}"`);
      if ((f.w < 44 || f.h < 44) && !inlineLink(e)) hits.smallTargets.push(`${nm(e)} ${Math.round(f.w)}x${Math.round(f.h)} "${tx(e)}"`);
    }
    // Card inside a card: a framed block taller than a control inside another framed block. Controls and chips inside a card are fine.
    if (f.framed && f.h > 44 && f.w > 44 && !e.matches(ctl)) {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const g = frame(p); if (vis(p) && g.framed && g.w > f.w + 4) { hits.boxInBox.push(`${nm(p)} > ${nm(e)} "${tx(e)}"`); break; } } }
    if (f.framed && f.rad >= f.h / 2 - 1 && f.h < 44 && f.w > f.h * 1.4) {
      for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) {
        const g = frame(q); if (vis(q) && g.framed && g.rad >= g.h / 2 - 1 && g.h < 60 && g.w > f.w) { hits.pillInPill.push(`${nm(q)} > ${nm(e)} "${tx(e)}"`); break; } } }
    if (f.sides.length === 1 && /Left|Right/.test(f.sides[0])) hits.sideStripes.push(`${nm(e)} border-${f.sides[0].toLowerCase()} "${tx(e)}"`);
    const m = s.boxShadow.match(/(-?[\d.]+)px 0px 0px 0px inset/); if (m && +m[1] !== 0) hits.sideStripes.push(`${nm(e)} inset shadow "${tx(e)}"`);
    if (e.tagName === 'HR') hits.dividers.push(`${nm(e)} ${Math.round(f.w)}x${Math.round(f.h)}`);
    else if (!f.sides.length && f.bg && ((f.w <= 2 && f.h > 8) || (f.h <= 2 && f.w > 8))) hits.dividers.push(`${nm(e)} ${Math.round(f.w)}x${Math.round(f.h)}`);
    else if (f.sides.length === 1 && /Top|Bottom/.test(f.sides[0]) && !e.matches(ctl)) hits.dividers.push(`${nm(e)} border-${f.sides[0].toLowerCase()} "${tx(e)}"`);
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (!own) continue;
    const px = parseFloat(s.fontSize), ls = parseFloat(s.letterSpacing) || 0;
    sizes.add(px); out.words += own.split(' ').length;
    if (px < 13) hits.smallText.push(`"${own.slice(0, 30)}" @${px}px`);
    if ((s.textTransform === 'uppercase' || s.fontVariantCaps.includes('small') || ls / px > 0.03) && px <= 15 && /[a-z]/i.test(own)) hits.tinyCaps.push(`"${own.slice(0, 30)}" @${px}px`);
    if (/ · /.test(own)) hits.middleDots.push(`"${own.slice(0, 50)}"`);
    const fg = rgba(s.color), bg = backdrop(e);
    if (!fg || !bg) out.contrastUnknown++;
    else { const cr = ratio(blend({ ...fg, a: fg.a * opacity(e) }, bg), bg), large = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700), need = large ? 3 : 4.5;
      if (cr < need) hits.lowContrast.push(`${cr.toFixed(2)}:1 (needs ${need}) "${own.slice(0, 30)}" @${px}px`); }
  }
  out.fontSizes = [...sizes].sort((a, b) => a - b);
  out.radii = [...radii];
  // Keep one line per distinct hit, with how many times it occurs; counts are totals.
  for (const k in hits) {
    const c = new Map(); for (const h of hits[k]) c.set(h, (c.get(h) || 0) + 1);
    out[k] = { count: hits[k].length, hits: [...c].map(([h, n]) => (n > 1 ? `${h} x${n}` : h)) };
  }
  return out;
};

export function summarise(result, phone) {
  const budget = BUDGET[phone ? 'phone' : 'desktop'];
  result.floor = FLOOR_KEYS.filter(k => result[k].count > 0);
  result.overBudget = Object.keys(budget).filter(k => result[k] > budget[k]);
  return result;
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(e.message); console.error(USAGE); process.exit(1); }
  if (o.help) { console.log(USAGE); return; }
  let pw;
  try { pw = await loadPlaywright(); } catch (e) { console.error(e.message); process.exit(1); }
  const { chromium, devices } = pw;

  let browser;
  try { browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }); }
  catch (e) { console.error(`Could not start Chromium: ${e.message.split('\n')[0]}. Run: npx playwright install chromium`); process.exit(1); }
  const fail = async msg => { console.error(msg); await browser.close(); process.exit(1); };
  const iphone = devices?.['iPhone 13'];
  const ctx = await browser.newContext(o.phone
    ? { ...(iphone || { isMobile: true, hasTouch: true }), viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }
    : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  let status = null;
  try { const res = await page.goto(o.url, { waitUntil: 'load', timeout: 45000 }); status = res?.status() ?? null; }
  catch (e) { await fail(`Could not open ${o.url}: ${e.message.split('\n')[0]}`); }
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  if (status && (status < 200 || status > 299)) console.error(`Warning: ${o.url} answered HTTP ${status}; measuring what it shows.`);
  await page.waitForTimeout(o.wait);
  for (const sel of o.clicks) {
    try { await page.locator(sel).first().click({ timeout: 10000 }); }
    catch (e) { await fail(`Could not click "${sel}": ${e.message.split('\n')[0]}`); }
    await page.waitForTimeout(o.wait);
  }
  const result = summarise({ url: o.url, status, device: o.phone ? 'phone 390x844' : 'desktop 1280x800', ...(o.units ? { units: o.units } : {}), ...(await page.evaluate(check)) }, o.phone);
  for (const f of [o.out, o.shot]) if (f) mkdirSync(dirname(resolve(f)), { recursive: true });
  if (o.shot) await page.screenshot({ path: o.shot, quality: 80, type: 'jpeg' });
  await browser.close();

  const json = JSON.stringify(result, null, 2);
  if (o.out) writeFileSync(o.out, json);
  const b = BUDGET[o.phone ? 'phone' : 'desktop'];
  console.log(`${result.device}  words ${result.words}/${b.words}  controls ${result.controls}/${b.controls}  font sizes ${result.fontSizes.length}  radii ${result.radii.length}`);
  for (const k of ['controlInControl', 'pillInPill', 'boxInBox', 'sideStripes', 'dividers', 'smallText', 'tinyCaps', 'middleDots', 'smallTargets', 'lowContrast'])
    console.log(`${k.padEnd(17)} ${String(result[k].count).padStart(3)}${FLOOR_KEYS.includes(k) && result[k].count ? '  floor' : ''}`);
  console.log(`contrastUnknown   ${String(result.contrastUnknown).padStart(3)}  (text over images, gradients or canvas: check by eye)`);
  console.log(result.floor.length ? `Floor: fails ${result.floor.join(', ')}` : 'Floor: passes');
  if (!o.out) console.log(json);
}

const isMain = (() => { try { return import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1] || ''))).href; } catch { return false; } })();
if (isMain) main();
