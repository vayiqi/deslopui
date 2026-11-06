import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { aggregate, validateJuror, trimmed, loadRound } from '../deslop-ui/scripts/aggregate.mjs';

const script = fileURLToPath(new URL('../deslop-ui/scripts/aggregate.mjs', import.meta.url));
const all = v => ({ SYS: v, COL: v, TYP: v, LAY: v, TXT: v, SPEC: v });
const juror = (lens, units) => ({ file: `juror-${lens}.json`, lens, units: units.map(([u, v, fixes = []]) => ({ u, sub: typeof v === 'number' ? all(v) : v, fixes })) });

test('trimmed mean drops one high and one low from five or more', () => {
  assert.equal(trimmed([1, 7, 7, 7, 10]), 7);
  assert.equal(trimmed([6, 8]), 7);
  assert.equal(trimmed([2, 7, 8]), 7, 'fewer than five: median');
});

test('unit score is capped at the lowest dimension + 1.5', () => {
  const s = aggregate([juror('a', [['NAV', { SYS: 9, COL: 9, TYP: 9, LAY: 9, TXT: 9, SPEC: 5 }]])]);
  assert.equal(s.units[0].score, 6.5);
  assert.equal(s.units[0].lowest, 'SPEC');
});

test('fixes are credited to the juror who wrote them, even when another juror skipped the unit', () => {
  const s = aggregate([
    juror('typographer', [['NAV', 7]]),
    juror('copy editor', [['NAV', 7], ['CARD', 6, [{ dim: 'TXT', sev: 'P1', fix: 'Cut the caption.' }]]]),
  ]);
  const card = s.units.find(u => u.u === 'CARD');
  assert.equal(card.fixes[0].juror, 'copy editor');
  assert.equal(card.jurors, 1);
});

test('incomplete or out-of-range units are rejected with a reason', () => {
  const v = validateJuror({ units: [
    { u: 'NAV', sub: { SYS: 7, COL: 7, TYP: 7, LAY: 7, TXT: 7 } },
    { u: 'CARD', sub: { ...all(7), SPEC: 11 } },
    { u: 'HERO', sub: { ...all(7), TYP: '7' } },
    { u: 'OK', sub: all(8) },
  ] }, 'juror-01.json');
  assert.deepEqual(v.units.map(u => u.u), ['OK']);
  assert.equal(v.problems.length, 3);
  assert.match(v.problems[0], /SPEC/);
  assert.deepEqual(validateJuror([], 'x').units, []);
  assert.deepEqual(validateJuror(null, 'x').units, []);
  assert.match(validateJuror({}, 'x').problems[0], /units/);
});

test('a failed structural Floor caps the unit at 7.0', () => {
  const j = [juror('a', [['NAV', 9], ['CARD', 9]])];
  const s = aggregate(j, { checks: [{ file: 'check-phone.json', floor: ['lowContrast'], units: ['NAV'] }] });
  assert.equal(s.units.find(u => u.u === 'NAV').score, 7);
  assert.equal(s.units.find(u => u.u === 'CARD').score, 9);
  const all2 = aggregate(j, { checks: [{ file: 'check-desktop.json', floor: ['smallTargets'], units: null }] });
  assert.ok(all2.units.every(u => u.score === 7));
});

test('decisions: target, plateau over two flat rounds, max rounds', () => {
  const j = v => [1, 2, 3, 4, 5].map(i => juror(`j${i}`, [['NAV', v]]));
  assert.equal(aggregate(j(9), { target: 8.5 }).decision, 'target-reached');
  const r1 = aggregate(j(7), { round: 1 });
  const r2 = aggregate(j(7.1), { round: 2, prev: r1 });
  assert.equal(r2.decision, 'continue', 'one flat round is not a plateau');
  const r3 = aggregate(j(7.2), { round: 3, prev: r2 });
  assert.equal(r3.decision, 'plateau');
  assert.equal(aggregate(j(7), { round: 6, maxRounds: 6, prev: aggregate(j(6), {}) }).decision, 'max-rounds');
});

test('the plateau band widens when jurors disagree', () => {
  const noisy = [3, 5, 7, 9, 10].map((v, i) => juror(`j${i}`, [['NAV', v]]));
  assert.ok(aggregate(noisy).plateauBand > 0.2);
  const calm = [7, 7, 7, 7, 7].map((v, i) => juror(`j${i}`, [['NAV', v]]));
  assert.equal(aggregate(calm).plateauBand, 0.2);
});

test('regressions are units that drop more than 0.5', () => {
  const prev = aggregate([juror('a', [['NAV', 8], ['CARD', 8]])]);
  const s = aggregate([juror('b', [['NAV', 7], ['CARD', 7.8]])], { prev });
  assert.deepEqual(s.regressions, ['NAV']);
});

test('CLI: writes summary.json, infers the round, reports bad files and fails cleanly', () => {
  const root = mkdtempSync(join(tmpdir(), 'deslop-'));
  const dir = join(root, 'round-1'); mkdirSync(dir);
  writeFileSync(join(dir, 'juror-01.json'), JSON.stringify({ lens: 'typographer', units: [{ u: 'NAV', sub: all(7) }] }));
  writeFileSync(join(dir, 'juror-02.json'), '{not json');
  writeFileSync(join(dir, 'check-phone.json'), JSON.stringify({ floor: [] }));
  const out = spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stderr, /juror-02\.json: not valid JSON/);
  const s = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
  assert.equal(s.round, 1);
  assert.equal(s.units[0].score, 7);
  assert.equal(spawnSync(process.execPath, [script, join(root, 'missing')]).status, 1);
  const empty = join(root, 'round-2'); mkdirSync(empty);
  writeFileSync(join(empty, 'juror-01.json'), JSON.stringify({ units: [] }));
  const e = spawnSync(process.execPath, [script, empty, dir], { encoding: 'utf8' });
  assert.equal(e.status, 1);
  assert.match(e.stderr, /No usable/);
  assert.equal(spawnSync(process.execPath, [script, dir, '--target', 'high']).status, 1);
});
