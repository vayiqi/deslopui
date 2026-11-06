#!/usr/bin/env node
// Structural check for UI slop. Opens a page in Chromium and reads the computed styles of everything visible at first view.
// Needs Node 20+ and Playwright with a Chromium build: npm i -D playwright && npx playwright install chromium
// Exit codes: 0 Floor passes, 2 Floor fails, 1 the check could not run.

import { writeFileSync, mkdirSync, realpathSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join, resolve, dirname, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: node structure-check.mjs <url or file> [options]
  --phone               iPhone 390x844 instead of desktop 1280x800; adds the 44px touch-target house rule
  --dark                emulate prefers-color-scheme: dark
  --wait ms             wait after load and after each click (default 3000)
  --click "selector"    click before measuring; repeat for several steps
  --storage-state f     Playwright storage state (cookies, local storage) for pages behind a sign-in
  --units A,B           the scored units on this screen, for the grading loop
  --waive k1,k2         house rules the design contract waives: touchTargets, smallText, tinyCaps
  --out file.json       save the full result
  --shot file.jpg|png   save a screenshot of the measured state
  --json                print the JSON result instead of the table`;

// Rules the script can measure without judgement. Any hit blocks shipping (the Floor in SKILL.md).
export const FLOOR_KEYS = ['controlInControl', 'lowContrast', 'smallTargets', 'touchTargets', 'smallText', 'tinyCaps'];
// House rules, stricter than WCAG AA, that a design contract may waive. AA rules can never be waived.
export const WAIVABLE = ['touchTargets', 'smallText', 'tinyCaps'];
// First-view budgets from SKILL.md. Reported, not Floor: the script cannot tell interface text from content.
export const BUDGET = { phone: { words: 25, controls: 5 }, desktop: { words: 40, controls: 7 } };
// smallTargets: WCAG 2.5.8 (AA), 24px or spaced so 24px circles do not touch. touchTargets: house rule, 44px on phone (as 2.5.5, AAA).

export function parseArgs(argv) {
  const takes = new Set(['--wait', '--click', '--out', '--shot', '--units', '--waive', '--storage-state']);
  const flags = new Set(['--phone', '--dark', '--json', '-h', '--help']);
  const o = { url: null, phone: false, dark: false, json: false, wait: 3000, clicks: [], units: null, waive: [], storageState: null, out: null, shot: null, help: false };
  const list = v => v.split(',').map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], v;
    if (a.startsWith('--') && a.includes('=')) [a, v] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)];
    if (flags.has(a)) {
      if (a === '-h' || a === '--help') o.help = true; else o[a.slice(2)] = true;
      continue;
    }
    if (a.startsWith('-')) {
      if (!takes.has(a)) throw new Error(`Unknown option ${a}`);
      if (v === undefined) { v = argv[i + 1]; i++; }
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      if (a === '--wait') { o.wait = Number(v); if (!Number.isFinite(o.wait) || o.wait < 0) throw new Error('--wait needs a number of milliseconds'); }
      else if (a === '--click') o.clicks.push(v);
      else if (a === '--units') o.units = list(v);
      else if (a === '--waive') {
        o.waive = list(v);
        const bad = o.waive.filter(k => !WAIVABLE.includes(k));
        if (bad.length) throw new Error(`Cannot waive ${bad.join(', ')}: only house rules can be waived (${WAIVABLE.join(', ')}); WCAG AA rules cannot.`);
      }
      else if (a === '--storage-state') o.storageState = v;
      else if (a === '--out') o.out = v;
      else if (a === '--shot') o.shot = v;
      continue;
    }
    if (o.url) throw new Error(`Unexpected argument ${a}`);
    o.url = a;
  }
  if (o.help) return o;
  if (!o.url) throw new Error('Give a URL or an HTML file to check');
  if (!/^[a-z]+:\/\//i.test(o.url)) {
    if (existsSync(o.url) && statSync(o.url).isFile()) o.url = pathToFileURL(resolve(o.url)).href;
    else if (existsSync(o.url)) throw new Error(`${o.url} is a folder; give the HTML file inside it, or serve it and pass the URL`);
    else throw new Error(`Not a URL and no such file: ${o.url}. URLs start with http://, https:// or file://`);
  }
  if (!/^(https?|file):\/\//i.test(o.url)) throw new Error(`URL must start with http://, https:// or file:// (got ${o.url})`);
  if (o.storageState && !existsSync(o.storageState)) throw new Error(`No such storage state file: ${o.storageState}`);
  return o;
}

// Finds Playwright next to this script, in the current project, or in the global npm folder.
export async function loadPlaywright() {
  try { const m = await import('playwright'); return m.chromium ? m : m.default; } catch {}
  const bases = [join(process.cwd(), 'noop.js'), import.meta.url];
  for (const base of bases) { try { return createRequire(base)('playwright'); } catch {} }
  try { return createRequire(join(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 'noop.js'))('playwright'); } catch {}
  throw new Error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
}

// Runs inside the page. Must be self-contained: Playwright serialises it.
export const check = ({ touch = false } = {}) => {
  // Any CSS colour (rgb, hex, oklch, lab, color-mix...) to sRGB through a 1x1 canvas.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true }), cache = new Map();
  const rgba = c => {
    if (!c || c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (cache.has(c)) return cache.get(c);
    // An invalid colour leaves the sentinel in place.
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#010203'; cx.fillStyle = c;
    let v = null;
    if (cx.fillStyle !== '#010203' || /^(#010203|rgba?\(1, 2, 3(, 1)?\))$/i.test(c.trim())) {
      cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; v = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    }
    cache.set(c, v); return v; };
  const hiddenClip = e => { for (let p = e; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p), r = p.getBoundingClientRect();
      if (/^(absolute|fixed)$/.test(s.position) && s.clip !== 'auto' && /rect\(0(px)?,? 0(px)?/.test(s.clip)) return true;
      if (/inset\(50%\)|circle\(0/.test(s.clipPath)) return true;
      if (r.width <= 1 && r.height <= 1 && s.overflow === 'hidden') return true; }
    return false; };
  const opacity = e => { let o = 1; for (let p = e; p; p = p.parentElement) o *= +getComputedStyle(p).opacity; return o; };
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && opacity(e) > .05 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const nm = e => { const c = String(e.className?.baseVal ?? e.className ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${c.length ? '.' + c.join('.') : ''}`; };
  const tx = e => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const ctl = 'button,a[href],[role=button],input:not([type=hidden]),select,textarea,summary';
  const disabled = e => !!e.closest(':disabled,[aria-disabled=true],fieldset:disabled');
  const transparent = c => { const v = rgba(c); return !v || v.a === 0; };
  const frame = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    const bg = !transparent(s.backgroundColor) || s.backgroundImage !== 'none';
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none');
    const sh = s.boxShadow !== 'none' && !/inset/.test(s.boxShadow), rad = parseFloat(s.borderRadius) || 0;
    return { framed: (bg && (rad > 0 || sh)) || sides.length === 4 || sh, sides, rad, w: r.width, h: r.height, bg }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  const canvas = /dark/.test(scheme) && (!/light/.test(scheme) || dark) ? { r: 18, g: 18, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  const opaqueMedia = p => ['CANVAS', 'VIDEO', 'IMG', 'IFRAME', 'svg'].includes(p.tagName) || getComputedStyle(p).backgroundImage !== 'none';
  // Premultiplied compositing, so opacity groups are handled the way the browser paints them.
  const pm = c => ({ r: c.r * c.a, g: c.g * c.a, b: c.b * c.a, a: c.a });
  const over = (t, b) => ({ r: t.r + b.r * (1 - t.a), g: t.g + b.g * (1 - t.a), b: t.b + b.b * (1 - t.a), a: t.a + b.a * (1 - t.a) });
  const fade = (c, o) => ({ r: c.r * o, g: c.g * o, b: c.b * o, a: c.a * o });
  const flat = c => ({ r: c.r, g: c.g, b: c.b, a: 1 });
  // The colours behind and of the text, as painted: { bg, fg }, or null when an image, gradient, canvas or video sits behind it.
  const paint = (e, fg) => {
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
      if (c === null) return null;
      if (c.a > 0) { layers.push(p); if (c.a >= 1 && opacity(p) >= 1) break; }
    }
    const base = pm(canvas);
    if (layers.every(p => p === e || p.contains(e))) {
      // Everything behind is an ancestor: paint the chain from the text out, applying each element's opacity to its whole subtree.
      const chain = []; for (let p = e; p; p = p.parentElement) chain.push(p);
      const run = withText => { let acc = { r: 0, g: 0, b: 0, a: 0 };
        for (const p of chain) { const st = getComputedStyle(p);
          acc = over(acc, pm(rgba(st.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 }));
          if (p === e && withText) acc = over(pm(fg), acc);
          acc = fade(acc, +st.opacity); }
        return flat(over(acc, base)); };
      return { bg: run(false), fg: run(true) };
    }
    // Siblings painted behind: stack the layers bottom-up, each faded by its own opacity.
    let b = base; for (const p of layers.reverse()) b = over(fade(pm(rgba(getComputedStyle(p).backgroundColor)), opacity(p)), b);
    return { bg: flat(b), fg: flat(over(fade(pm(fg), opacity(e)), b)) }; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // WCAG 2.5.8 exempts a link inside a sentence: an inline link whose parent has text of its own.
  const inlineLink = e => e.tagName === 'A' && getComputedStyle(e).display === 'inline' && [...(e.parentElement?.childNodes || [])].some(n => n.nodeType === 3 && n.textContent.trim());
  // The hit area of a checkbox or radio includes its label.
  const hitBox = e => { const r = e.getBoundingClientRect(); let { left, top, right, bottom } = r;
    for (const l of [...(e.labels || [])]) { const q = l.getBoundingClientRect(); if (q.width * q.height > (right - left) * (bottom - top)) ({ left, top, right, bottom } = q); }
    return { left, top, right, bottom, w: right - left, h: bottom - top }; };
  // WCAG 2.5.8 exempts controls the browser draws unstyled, such as a native checkbox.
  const native = e => e.matches('input[type=checkbox],input[type=radio],input[type=range],input[type=color],input[type=file],select') && getComputedStyle(e).appearance !== 'none';
  const targets = [];

  const hits = { controlInControl: [], boxInBox: [], pillInPill: [], sideStripes: [], dividers: [], smallText: [], tinyCaps: [], middleDots: [], smallTargets: [], touchTargets: [], lowContrast: [] };
  const out = { words: 0, controls: 0, fontSizes: [], radii: [], contrastUnknown: 0 };
  const sizes = new Set(), radii = new Set();
  for (const e of [...document.querySelectorAll('body *')].filter(vis)) {
    const s = getComputedStyle(e), f = frame(e);
    if (f.rad) radii.add(s.borderRadius);
    const srOnly = hiddenClip(e);
    if (e.matches(ctl) && !srOnly) {
      out.controls++;
      const p = e.parentElement?.closest(ctl); if (p && vis(p)) hits.controlInControl.push(`${nm(p)} > ${nm(e)} "${tx(e)}"`);
      if (!inlineLink(e) && !disabled(e)) targets.push({ e, ...hitBox(e) });
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
    if (!own || srOnly) continue;
    const px = parseFloat(s.fontSize), ls = parseFloat(s.letterSpacing) || 0;
    // A CJK character is about half a word; other scripts count by spaces.
    const cjk = (own.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/g) || []).length;
    const rest = own.replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/g, ' ').trim();
    sizes.add(px); out.words += (rest ? rest.split(/\s+/).length : 0) + Math.ceil(cjk / 2);
    if (px < 13) hits.smallText.push(`"${own.slice(0, 30)}" @${px}px`);
    if ((s.textTransform === 'uppercase' || s.fontVariantCaps.includes('small') || ls / px > 0.03) && px <= 15 && /[a-z]/i.test(own)) hits.tinyCaps.push(`"${own.slice(0, 30)}" @${px}px`);
    if (/ · /.test(own)) hits.middleDots.push(`"${own.slice(0, 50)}"`);
    if (disabled(e)) continue;   // WCAG 1.4.3 exempts inactive controls
    const fg = rgba(s.color), pt = fg && !(e instanceof SVGElement) && s.textShadow === 'none' && s.mixBlendMode === 'normal' && s.filter === 'none' ? paint(e, fg) : null;
    if (!pt) out.contrastUnknown++;
    else { const cr = ratio(pt.fg, pt.bg);
      // Large text (WCAG): 18pt (24px), or 14pt (18.667px) at weight 700 or more.
      const large = px >= 24 || (px >= 18.6 && +s.fontWeight >= 700), need = large ? 3 : 4.5;
      if (cr < need) hits.lowContrast.push(`${(Math.floor(cr * 100) / 100).toFixed(2)}:1 (needs ${need}) "${own.slice(0, 30)}" @${px}px`); }
  }
  // 2.5.8: an undersized target passes if a 24px circle on its centre touches no other target and no other such circle.
  const small = targets.filter(t => (t.w < 24 || t.h < 24) && !native(t.e));
  const centre = t => [(t.left + t.right) / 2, (t.top + t.bottom) / 2];
  const distToBox = ([x, y], t) => Math.hypot(Math.max(t.left - x, 0, x - t.right), Math.max(t.top - y, 0, y - t.bottom));
  for (const t of small) {
    const c = centre(t);
    const crowded = targets.some(o => o !== t && !o.e.contains(t.e) && !t.e.contains(o.e) &&
      (distToBox(c, o) < 12 || (small.includes(o) && Math.hypot(c[0] - centre(o)[0], c[1] - centre(o)[1]) < 24)));
    if (crowded) hits.smallTargets.push(`${nm(t.e)} ${Math.round(t.w)}x${Math.round(t.h)} "${tx(t.e)}"`);
  }
  if (touch) for (const t of targets) if ((t.w < 44 || t.h < 44) && !native(t.e)) hits.touchTargets.push(`${nm(t.e)} ${Math.round(t.w)}x${Math.round(t.h)} "${tx(t.e)}"`);
  out.fontSizes = [...sizes].sort((a, b) => a - b);
  out.radii = [...radii];
  // Keep one line per distinct hit, with how many times it occurs; counts are totals.
  for (const k in hits) {
    const c = new Map(); for (const h of hits[k]) c.set(h, (c.get(h) || 0) + 1);
    out[k] = { count: hits[k].length, hits: [...c].map(([h, n]) => (n > 1 ? `${h} x${n}` : h)) };
  }
  return out;
};

export function summarise(result, phone, waive = []) {
  const budget = BUDGET[phone ? 'phone' : 'desktop'];
  result.waived = FLOOR_KEYS.filter(k => waive.includes(k) && result[k].count > 0);
  result.floor = FLOOR_KEYS.filter(k => result[k].count > 0 && !waive.includes(k));
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
  // The GL flags let WebGL pages render in a headless browser.
  try { browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }); }
  catch (e) { console.error(`Could not start Chromium: ${e.message.split('\n')[0]}. Run: npx playwright install chromium`); process.exit(1); }
  const fail = async msg => { console.error(msg); await browser.close(); process.exit(1); };
  const iphone = devices?.['iPhone 13'];
  const base = { deviceScaleFactor: 1, colorScheme: o.dark ? 'dark' : 'light', ...(o.storageState ? { storageState: o.storageState } : {}) };
  const ctx = await browser.newContext(o.phone
    ? { ...(iphone || { isMobile: true, hasTouch: true }), ...base, viewport: { width: 390, height: 844 } }
    : { ...base, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let status = null;
  try { const res = await page.goto(o.url, { waitUntil: 'load', timeout: 45000 }); status = res?.status() ?? null; }
  catch (e) { await fail(`Could not open ${o.url}: ${e.message.split('\n')[0]}`); }
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  if (status && (status < 200 || status > 399)) await fail(`${o.url} answered HTTP ${status}; fix the page or the URL first.`);
  await page.waitForTimeout(o.wait);
  for (const sel of o.clicks) {
    try { await page.locator(sel).first().click({ timeout: 10000 }); }
    catch (e) { await fail(`Could not click "${sel}": ${e.message.split('\n')[0]}`); }
    await page.waitForTimeout(o.wait);
  }
  const device = o.phone ? 'phone' : 'desktop';
  let measured;
  try { measured = await page.evaluate(check, { touch: o.phone }); }
  catch (e) { await fail(`Could not measure the page: ${e.message.split('\n')[0]}`); }
  const result = summarise({ url: o.url, status, device: `${device} ${o.phone ? '390x844' : '1280x800'}${o.dark ? ' dark' : ''}`,
    ...(o.units ? { units: o.units } : {}), ...measured }, o.phone, o.waive);
  for (const f of [o.out, o.shot]) if (f) mkdirSync(dirname(resolve(f)), { recursive: true });
  if (o.shot) await page.screenshot(extname(o.shot).toLowerCase() === '.png' ? { path: o.shot, type: 'png' } : { path: o.shot, type: 'jpeg', quality: 80 });
  await browser.close();

  const json = JSON.stringify(result, null, 2);
  if (o.out) writeFileSync(o.out, json);
  if (o.json) console.log(json);
  else {
    const b = BUDGET[device];
    console.log(`${result.device}  words ${result.words}/${b.words}  controls ${result.controls}/${b.controls}  font sizes ${result.fontSizes.length}  radii ${result.radii.length}`);
    for (const k of ['controlInControl', 'pillInPill', 'boxInBox', 'sideStripes', 'dividers', 'smallText', 'tinyCaps', 'middleDots', 'smallTargets', ...(o.phone ? ['touchTargets'] : []), 'lowContrast'])
      console.log(`${k.padEnd(17)} ${String(result[k].count).padStart(3)}${result.floor.includes(k) ? '  floor' : result.waived.includes(k) ? '  waived' : ''}`);
    console.log(`contrastUnknown   ${String(result.contrastUnknown).padStart(3)}  (check by eye: text over images, gradients, canvas, blend modes or shadows)`);
    if (result.overBudget.length) console.log(`Over budget: ${result.overBudget.join(', ')} (judge: content does not count)`);
    console.log(result.floor.length ? `Floor: fails ${result.floor.join(', ')}` : 'Floor: passes');
  }
  process.exit(result.floor.length ? 2 : 0);
}

const isMain = (() => { try { return import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1] || ''))).href; } catch { return false; } })();
if (isMain) main();
