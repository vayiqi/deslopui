#!/usr/bin/env node
// Aggregate one grading round. Reads juror-*.json (and check-*.json) in a round folder, writes summary.json.
// Usage: node aggregate.mjs <round-dir> [previous-round-dir] [--target 8.5] [--round N] [--max-rounds 6]

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DIMS = ['SYS', 'COL', 'TYP', 'LAY', 'TXT', 'SPEC'];
export const FLOOR_CAP = 7.0;     // a unit that fails the structural Floor scores at most this
export const MIN_PLATEAU = 0.2;   // smallest overall move that counts as progress
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
export const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// Five or more scores: drop the highest and lowest and average the rest. Fewer: the median.
export const trimmed = xs => { const s = [...xs].sort((a, b) => a - b); return s.length >= 5 ? mean(s.slice(1, -1)) : median(s); };
const unitScore = dimMeans => { const v = Object.values(dimMeans); return Math.min(mean(v), Math.min(...v) + 1.5); };

// Check one juror file. Returns the units that are complete and valid, and a reason for each one that is not.
export function validateJuror(data, file) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { units: [], problems: [`${file}: not a JSON object`] };
  if (typeof data.error === 'string') return { units: [], problems: [`${file}: the juror could not judge: ${data.error}`] };
  if (!Array.isArray(data.units)) return { units: [], problems: [`${file}: no "units" array`] };
  const units = [];
  for (const [i, u] of data.units.entries()) {
    const name = typeof u?.u === 'string' && u.u.trim() ? u.u.trim() : null;
    if (!name) { problems.push(`${file}: unit #${i + 1} has no name`); continue; }
    const bad = DIMS.filter(d => { const x = u.sub?.[d]; return typeof x !== 'number' || !Number.isFinite(x) || x < 1 || x > 10; });
    if (bad.length) { problems.push(`${file}: ${name} missing or out of range 1-10: ${bad.join(', ')}`); continue; }
    if (units.some(x => x.u === name)) { problems.push(`${file}: ${name} scored twice, kept the first`); continue; }
    const fixes = Array.isArray(u.fixes) ? u.fixes.filter(f => f && typeof f.fix === 'string') : [];
    units.push({ u: name, sub: Object.fromEntries(DIMS.map(d => [d, u.sub[d]])), fixes });
  }
  return { units, problems };
}

// Pure aggregation, for tests and the CLI.
// jurors: [{ file, lens, units }] (already validated). checks: [{ file, floor: [...], units?: [...] }].
export function aggregate(jurors, { prev = null, checks = [], target = 8.5, round = null, maxRounds = 6 } = {}) {
  const names = [...new Set(jurors.flatMap(j => j.units.map(u => u.u)))];
  if (!names.length) throw new Error('No valid unit scores in this round.');
  const units = names.map(name => {
    const entries = jurors.flatMap(j => { const e = j.units.find(u => u.u === name); return e ? [{ juror: j.file, lens: j.lens, e }] : []; });
    const dims = {};
    for (const d of DIMS) {
      const xs = entries.map(x => x.e.sub[d]);
      dims[d] = { mean: r1(trimmed(xs)), median: median(xs), spread: Math.max(...xs) - Math.min(...xs), n: xs.length };
    }
    const raw = unitScore(Object.fromEntries(DIMS.map(d => [d, dims[d].mean])));
    const floorFails = checks.filter(c => c.floor?.length && (!c.units || c.units.includes(name)))
      .map(c => `${c.file}: ${c.floor.join(', ')}`);
    const score = r1(floorFails.length ? Math.min(raw, FLOOR_CAP) : raw);
    const lowest = DIMS.slice().sort((a, b) => dims[a].mean - dims[b].mean)[0];
    return {
      u: name, score, uncapped: r1(raw), lowest, jurors: entries.length, dims,
      disputed: DIMS.filter(d => dims[d].spread > 3), floor: floorFails,
      capped: floorFails.length > 0 && raw > FLOOR_CAP,
      fixes: entries.flatMap(x => x.e.fixes.map(f => ({ ...f, juror: x.juror, lens: x.lens }))),
    };
  });

  const overall = r2(mean(units.map(u => u.score)));
  // Noise: how much the overall would move if the panel changed. Each juror's own overall, spread over sqrt(n).
  const perJuror = jurors.filter(j => j.units.length).map(j => mean(j.units.map(u => unitScore(u.sub))));
  const sd = perJuror.length > 1 ? Math.sqrt(perJuror.reduce((a, x) => a + (x - mean(perJuror)) ** 2, 0) / (perJuror.length - 1)) : 0;
  const plateauBand = r2(Math.max(MIN_PLATEAU, perJuror.length > 1 ? 2 * sd / Math.sqrt(perJuror.length) : 0));

  const delta = prev ? r2(overall - prev.overall) : null;
  const regressions = prev ? units.filter(u => { const p = prev.units?.find(x => x.u === u.u); return p && u.score < p.score - 0.5; }).map(u => u.u) : [];
  const prevFlat = prev && prev.delta !== null && prev.delta !== undefined && Math.abs(prev.delta) <= (prev.plateauBand ?? MIN_PLATEAU);
  const flat = delta !== null && Math.abs(delta) <= plateauBand;

  let decision = 'continue';
  if (units.every(u => u.score >= target)) decision = 'target-reached';
  else if (flat && prevFlat) decision = 'plateau';
  else if (round && round >= maxRounds) decision = 'max-rounds';

  return { round, jurors: jurors.length, target, maxRounds, overall, delta, plateauBand, decision, regressions,
    units: units.sort((a, b) => a.score - b.score) };
}

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

export function loadRound(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`Round folder not found: ${dir}`);
  const files = readdirSync(dir).sort();
  const problems = [], jurors = [];
  for (const f of files.filter(f => /^juror-.*\.json$/.test(f))) {
    let data; try { data = readJson(join(dir, f)); } catch (e) { problems.push(`${f}: not valid JSON (${e.message})`); continue; }
    const v = validateJuror(data, f); problems.push(...v.problems);
    if (v.units.length) jurors.push({ file: f, lens: typeof data.lens === 'string' ? data.lens : f, units: v.units });
  }
  const checks = [];
  for (const f of files.filter(f => /^check-.*\.json$/.test(f))) {
    try { const c = readJson(join(dir, f)); checks.push({ file: f, floor: Array.isArray(c.floor) ? c.floor : [], units: Array.isArray(c.units) ? c.units : null }); }
    catch (e) { problems.push(`${f}: not valid JSON (${e.message})`); }
  }
  return { jurors, checks, problems };
}

function main() {
  const args = process.argv.slice(2);
  const usage = 'Usage: node aggregate.mjs <round-dir> [previous-round-dir] [--target 8.5] [--round N] [--max-rounds 6]';
  const flags = {}, pos = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-h' || args[i] === '--help') { console.log(usage); return; }
    if (args[i].startsWith('--')) {
      let k = args[i], raw;
      if (k.includes('=')) [k, raw] = [k.slice(0, k.indexOf('=')), k.slice(k.indexOf('=') + 1)]; else raw = args[++i];
      const v = Number(raw);
      if (!['--target', '--round', '--max-rounds'].includes(k)) { console.error(`Unknown option ${k}\n${usage}`); process.exit(1); }
      if (raw === undefined || raw === '' || !Number.isFinite(v)) { console.error(`${k} needs a number\n${usage}`); process.exit(1); }
      flags[k] = v;
    } else pos.push(args[i]);
  }
  const [dir, prevDir] = pos;
  if (!dir || pos.length > 2) { console.error(pos.length > 2 ? `Unexpected argument ${pos[2]}\n${usage}` : usage); process.exit(1); }
  const round = flags['--round'] ?? (Number(basename(resolve(dir)).match(/(\d+)$/)?.[1]) || null);

  let loaded;
  try { loaded = loadRound(dir); } catch (e) { console.error(e.message); process.exit(1); }
  for (const p of loaded.problems) console.error(`skipped ${p}`);
  if (!loaded.jurors.length) { console.error('No usable juror-*.json files in this round.'); process.exit(1); }
  let prev = null;
  if (prevDir) {
    const p = join(prevDir, 'summary.json');
    if (!existsSync(p)) { console.error(`No summary.json in ${prevDir}; run this script on that round first.`); process.exit(1); }
    try { prev = readJson(p); if (typeof prev?.overall !== 'number' || !Array.isArray(prev.units)) throw new Error('not a summary from this script'); }
    catch (e) { console.error(`Cannot read ${p}: ${e.message.split('\n')[0]}`); process.exit(1); }
  }
  let summary;
  try { summary = aggregate(loaded.jurors, { prev, checks: loaded.checks, round, target: flags['--target'] ?? 8.5, maxRounds: flags['--max-rounds'] ?? 6 }); }
  catch (e) { console.error(e.message); process.exit(1); }
  summary.skipped = loaded.problems;
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

  const d = summary.delta;
  console.log(`round ${summary.round ?? '?'}  jurors ${summary.jurors}  overall ${summary.overall}${d !== null ? ` (${d >= 0 ? '+' : ''}${d}; moves within ±${summary.plateauBand} are noise)` : ''}  target ${summary.target}  decision ${summary.decision}`);
  for (const u of summary.units) console.log(`${u.u.padEnd(10)} ${u.score.toFixed(1).padStart(4)}  lowest ${u.lowest}${u.capped ? '  floor-capped' : u.floor.length ? '  floor-fails' : ''}${u.disputed.length ? `  disputed ${u.disputed.join(',')}` : ''}  fixes ${u.fixes.length}`);
  if (summary.regressions.length) console.log(`regressions: ${summary.regressions.join(', ')}`);
}

const isMain = (() => { try { return import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1] || ''))).href; } catch { return false; } })();
if (isMain) main();
