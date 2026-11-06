#!/usr/bin/env node
// Aggregate one grading round. Reads juror-*.json in a round folder, writes summary.json.
// Usage: node aggregate.mjs <round-dir> [previous-round-dir] [--target 8.5] [--round N] [--max-rounds 6]

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const [dir, prevDir] = pos;
if (!dir) { console.log('Usage: node aggregate.mjs <round-dir> [previous-round-dir] [--target 8.5] [--round N] [--max-rounds 6]'); process.exit(1); }
const target = Number(flag('--target', 8.5)), round = Number(flag('--round', 0)), maxRounds = Number(flag('--max-rounds', 6));
const DIMS = ['SYS', 'COL', 'TYP', 'LAY', 'TXT', 'SPEC'];
const r1 = x => Math.round(x * 10) / 10;

const jurors = readdirSync(dir).filter(f => /^juror-.*\.json$/.test(f)).sort().map(f => {
  try { return { file: f, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }; }
  catch (e) { console.error(`skipped ${f}: ${e.message}`); return null; }
}).filter(Boolean);
if (!jurors.length) { console.error('No juror-*.json files found.'); process.exit(1); }

const trimmed = xs => { const s = [...xs].sort((a, b) => a - b); const t = s.length >= 5 ? s.slice(1, -1) : s; return t.reduce((a, b) => a + b, 0) / t.length; };
const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const unitNames = [...new Set(jurors.flatMap(j => (j.units || []).map(u => u.u)))];
const units = unitNames.map(name => {
  const entries = jurors.map(j => (j.units || []).find(u => u.u === name)).filter(Boolean);
  const dims = {};
  for (const d of DIMS) {
    const xs = entries.map(e => Number(e.sub?.[d])).filter(x => Number.isFinite(x));
    if (!xs.length) continue;
    dims[d] = { mean: r1(trimmed(xs)), median: median(xs), spread: Math.max(...xs) - Math.min(...xs), n: xs.length };
  }
  const means = Object.values(dims).map(v => v.mean);
  const low = Math.min(...means), avg = means.reduce((a, b) => a + b, 0) / means.length;
  const lowest = Object.entries(dims).sort((a, b) => a[1].mean - b[1].mean)[0]?.[0];
  return {
    u: name, score: r1(Math.min(avg, low + 1.5)), lowest, dims,
    disputed: Object.entries(dims).filter(([, v]) => v.spread > 3).map(([k]) => k),
    fixes: entries.flatMap((e, i) => (e.fixes || []).map(f => ({ ...f, juror: jurors[i].lens || jurors[i].file }))),
  };
});

const overall = r1(units.reduce((a, u) => a + u.score, 0) / units.length);
let prev = null;
if (prevDir && existsSync(join(prevDir, 'summary.json'))) prev = JSON.parse(readFileSync(join(prevDir, 'summary.json'), 'utf8'));
const delta = prev ? r1(overall - prev.overall) : null;
const regressions = prev ? units.filter(u => { const p = prev.units.find(x => x.u === u.u); return p && u.score < p.score - 0.5; }).map(u => u.u) : [];
const prevFlat = prev && prev.delta !== null && Math.abs(prev.delta) <= 0.2;

let decision = 'continue';
if (units.every(u => u.score >= target)) decision = 'target-reached';
else if (delta !== null && Math.abs(delta) <= 0.2 && prevFlat) decision = 'plateau';
else if (round && round >= maxRounds) decision = 'max-rounds';

const summary = { round: round || null, jurors: jurors.length, target, overall, delta, decision, regressions,
  units: units.sort((a, b) => a.score - b.score) };
writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

console.log(`jurors ${jurors.length}  overall ${overall}${delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta})` : ''}  target ${target}  decision ${decision}`);
for (const u of summary.units) console.log(`${u.u.padEnd(10)} ${String(u.score).padStart(4)}  lowest ${u.lowest}${u.disputed.length ? `  disputed ${u.disputed.join(',')}` : ''}  fixes ${u.fixes.length}`);
if (regressions.length) console.log(`regressions: ${regressions.join(', ')}`);
