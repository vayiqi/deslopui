#!/usr/bin/env node
// Structural check for UI slop. Reads computed styles of everything visible at first view.
// Usage: node structure-check.mjs <url> [--phone] [--wait ms] [--click "selector"]... [--out file.json] [--shot file.jpg]
// Needs Playwright with a Chromium build: npm i -D playwright && npx playwright install chromium

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) {
  console.log('Usage: node structure-check.mjs <url> [--phone] [--wait ms] [--click "selector"]... [--out file.json] [--shot file.jpg]');
  process.exit(args.length ? 0 : 1);
}
const url = args[0];
const opt = (name, fallback) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : fallback; };
const clicks = args.flatMap((a, i) => (a === '--click' ? [args[i + 1]] : []));
const phone = args.includes('--phone');
const wait = Number(opt('--wait', 3000));

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); }   // falls back to a global install
  catch { console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium'); process.exit(1); }
}

export const check = () => {
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > .05 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const nm = e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className?.baseVal ?? e.className).trim().split(/\s+/).slice(0, 2).join('.')}`;
  const tx = e => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const ctl = 'button,a[href],[role=button],input,select,summary';
  const frame = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    const bg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none';
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none');
    const sh = s.boxShadow !== 'none', rad = parseFloat(s.borderRadius) || 0;
    return { framed: (bg && (rad > 0 || sh)) || sides.length === 4 || sh, sides, rad, w: r.width, h: r.height, bg }; };
  const out = { words: 0, controls: 0, fontSizes: [], radii: [], controlInControl: [], boxInBox: [], pillInPill: [], sideStripes: [], dividers: [], smallText: [], tinyCaps: [], middleDots: [], smallTargets: [] };
  const sizes = new Set(), radii = new Set();
  for (const e of [...document.querySelectorAll('body *')].filter(vis)) {
    const s = getComputedStyle(e), f = frame(e);
    if (f.rad) radii.add(s.borderRadius);
    if (e.matches(ctl)) {
      out.controls++;
      const p = e.parentElement?.closest(ctl); if (p && vis(p)) out.controlInControl.push(`${nm(p)} > ${nm(e)} "${tx(e)}"`);
      if ((f.w < 44 || f.h < 44) && !e.matches('input[type=hidden]')) out.smallTargets.push(`${nm(e)} ${Math.round(f.w)}x${Math.round(f.h)} "${tx(e)}"`);
    }
    if (f.framed && f.w > 8 && f.h > 8) {
      let p = e.parentElement, d = 0;
      while (p && p !== document.body) { const g = frame(p);
        if (vis(p) && g.framed && g.w > f.w + 4 && ++d >= (f.h > 40 ? 1 : 2)) { out.boxInBox.push(`${nm(p)} > ${nm(e)} "${tx(e)}"`); break; } p = p.parentElement; }
      if (f.rad >= f.h / 2 - 1 && f.h < 44 && f.w > f.h * 1.4) { let q = e.parentElement;
        while (q && q !== document.body) { const g = frame(q); if (vis(q) && g.framed && g.rad >= g.h / 2 - 1 && g.h < 60 && g.w > f.w) { out.pillInPill.push(`${nm(q)} > ${nm(e)} "${tx(e)}"`); break; } q = q.parentElement; } }
    }
    if (f.sides.length === 1 && /Left|Right/.test(f.sides[0])) out.sideStripes.push(`${nm(e)} border-${f.sides[0].toLowerCase()} "${tx(e)}"`);
    const m = s.boxShadow.match(/(-?[\d.]+)px 0px 0px 0px inset/); if (m && +m[1] !== 0) out.sideStripes.push(`${nm(e)} inset shadow "${tx(e)}"`);
    if (!f.sides.length && f.bg && ((f.w <= 2 && f.h > 8) || (f.h <= 2 && f.w > 8))) out.dividers.push(`${nm(e)} ${Math.round(f.w)}x${Math.round(f.h)}`);
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (!own) continue;
    const px = parseFloat(s.fontSize), ls = parseFloat(s.letterSpacing) || 0;
    sizes.add(px); out.words += own.split(' ').length;
    if (px < 13) out.smallText.push(`${own.slice(0, 30)} @${px}px`);
    if ((s.textTransform === 'uppercase' || s.fontVariantCaps.includes('small') || ls / px > 0.03) && px <= 15 && /[a-z]/i.test(own)) out.tinyCaps.push(`${own.slice(0, 30)} @${px}px`);
    if (/ · /.test(own)) out.middleDots.push(own.slice(0, 50));
  }
  out.fontSizes = [...sizes].sort((a, b) => a - b);
  out.radii = [...radii];
  for (const k in out) if (Array.isArray(out[k]) && typeof out[k][0] === 'string') out[k] = [...new Set(out[k])];
  return out;
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(phone
  ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
  : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(wait);
for (const sel of clicks) { await page.locator(sel).first().click(); await page.waitForTimeout(wait); }
const result = { url, device: phone ? 'phone 390x844' : 'desktop 1280x800', ...(await page.evaluate(check)) };
if (opt('--shot')) await page.screenshot({ path: opt('--shot'), quality: 80, type: 'jpeg' });
await browser.close();

const json = JSON.stringify(result, null, 2);
if (opt('--out')) writeFileSync(opt('--out'), json);
const n = k => (Array.isArray(result[k]) ? result[k].length : result[k]);
console.log(`${result.device}  words ${result.words}  controls ${result.controls}  font sizes ${result.fontSizes.length}  radii ${result.radii.length}`);
for (const k of ['controlInControl', 'pillInPill', 'boxInBox', 'sideStripes', 'dividers', 'smallText', 'tinyCaps', 'middleDots', 'smallTargets']) console.log(`${k.padEnd(17)} ${n(k)}`);
if (!opt('--out')) console.log(json);
