/**
 * =============================================================================
 * FILE: main.ts  (browser-gliner prototype — UI + orchestration)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   The page controller. Lets you pick a model variant (int8 / fp16) and an
 *   execution provider (WebGPU / WASM), load the model in-browser, then run
 *   all 120 traps from the production manifest through the in-browser
 *   GLiNER + production post-processing + production regex/allowlist/
 *   compound-risk scoring. It reports:
 *     - the gate result: pass count, wire leaks, false positives, misses
 *       (target = 120/120, 0 wire leaks, matching the production daemon),
 *     - latency stats (median / p95 / max inference ms) for THIS browser +
 *       provider — the data needed to answer "is WASM-floor / WebGPU latency
 *       acceptable, especially in Safari?",
 *     - a downloadable JSON report.
 *
 *   LIGHT MODE ONLY (project hard requirement).
 *
 * INPUT FILES:  ../../../tests/traps/manifest-v1.json  (read-only import)
 * OUTPUT FILES: browser download "browser-gliner-report-<variant>-<provider>.json"
 *               (user-initiated; nothing written to disk by the page itself)
 * =============================================================================
 */

import type { ExecutionProvider } from 'gliner';
import { BrowserGliner } from './glinerBrowser';
import { clearModelCache, type ModelVariant } from './modelCache';
import { evalTrapInputPhase, type Trap, type TrapResult } from './trapEval';
import manifest from '../../../tests/traps/manifest-v1.json';

const traps = (manifest as { traps: Trap[] }).traps;
const engine = new BrowserGliner();

const $ = (id: string) => document.getElementById(id)!;
const variantSel = $('variant') as HTMLSelectElement;
const providerSel = $('provider') as HTMLSelectElement;
const loadBtn = $('loadBtn') as HTMLButtonElement;
const runBtn = $('runBtn') as HTMLButtonElement;
const clearBtn = $('clearBtn') as HTMLButtonElement;
const statusEl = $('status');
const progressEl = $('progress');
const summaryEl = $('summary');
const tableEl = $('table');

let lastReport: unknown = null;

function setStatus(msg: string) { statusEl.textContent = msg; }
function fmtMB(bytes: number) { return (bytes / 1024 / 1024).toFixed(1) + ' MB'; }
function pct(n: number, d: number) { return d ? ((n / d) * 100).toFixed(1) + '%' : '—'; }

function stats(nums: number[]) {
  if (!nums.length) return { median: 0, p95: 0, max: 0, mean: 0 };
  const s = [...nums].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    median: q(0.5),
    p95: q(0.95),
    max: s[s.length - 1],
    mean: nums.reduce((a, b) => a + b, 0) / nums.length,
  };
}

loadBtn.onclick = async () => {
  const variant = variantSel.value as ModelVariant;
  const provider = providerSel.value as ExecutionProvider;
  loadBtn.disabled = true; runBtn.disabled = true; variantSel.disabled = true; providerSel.disabled = true;
  progressEl.textContent = '';
  try {
    setStatus(`Loading ${variant} via ${provider}…`);
    const t0 = performance.now();
    await engine.load(variant, provider, (p) => {
      if (p.fromCache) {
        progressEl.textContent = `model from CacheStorage (${fmtMB(p.receivedBytes)}) — no download`;
      } else {
        const total = p.totalBytes ? ` / ${fmtMB(p.totalBytes)}` : '';
        progressEl.textContent = `downloading weights: ${fmtMB(p.receivedBytes)}${total}`;
      }
    });
    const loadMs = performance.now() - t0;
    setStatus(`✅ Loaded ${variant} on ${provider} in ${(loadMs / 1000).toFixed(1)}s. Ready to run ${traps.length} traps.`);
    runBtn.disabled = false;
  } catch (err) {
    setStatus(`❌ Load failed: ${err instanceof Error ? err.message : String(err)}`);
    console.error(err);
    variantSel.disabled = false; providerSel.disabled = false;
  } finally {
    loadBtn.disabled = false;
  }
};

clearBtn.onclick = async () => {
  await clearModelCache();
  setStatus('CacheStorage cleared — next load will re-download.');
};

runBtn.onclick = async () => {
  if (!engine.ready) { setStatus('Load a model first.'); return; }
  runBtn.disabled = true; loadBtn.disabled = true;
  const results: TrapResult[] = [];
  const latencies: number[] = [];
  const t0 = performance.now();

  for (let i = 0; i < traps.length; i++) {
    const trap = traps[i];
    const { spans, inferenceMs } = await engine.detect(trap.input);
    latencies.push(inferenceMs);
    results.push(evalTrapInputPhase(trap, spans));
    if ((i + 1) % 10 === 0 || i === traps.length - 1) {
      setStatus(`Running… ${i + 1}/${traps.length}  (${results.filter(r => r.pass).length} pass so far)`);
      await new Promise((r) => setTimeout(r, 0)); // yield so UI repaints
    }
  }
  const elapsedS = (performance.now() - t0) / 1000;

  const passCount = results.filter((r) => r.pass).length;
  const wireLeakTraps = results.filter((r) => r.wireLeaks.length);
  const fpTraps = results.filter((r) => r.falsePositives.length);
  const missTraps = results.filter((r) => r.missed.length);
  const privMismatch = results.filter((r) => r.privilegedExpected !== undefined && r.privilegedExpected !== r.privilegedActual);
  const lat = stats(latencies);

  const byCategory: Record<string, { total: number; pass: number }> = {};
  for (const r of results) {
    byCategory[r.category] ??= { total: 0, pass: 0 };
    byCategory[r.category].total++;
    if (r.pass) byCategory[r.category].pass++;
  }

  const zeroLeak = wireLeakTraps.length === 0 && passCount === results.length;
  summaryEl.innerHTML = `
    <div class="verdict ${zeroLeak ? 'ok' : 'fail'}">
      ${zeroLeak ? '✅ ZERO LEAK — int8/variant holds the gate this run' : '⚠ FAIL — does not match production 120/120'}
    </div>
    <table class="kv">
      <tr><td>Variant / Provider</td><td><b>${engine.variant}</b> / <b>${engine.provider}</b></td></tr>
      <tr><td>Pass</td><td><b>${passCount} / ${results.length}</b> (${pct(passCount, results.length)})</td></tr>
      <tr><td>Wire leaks</td><td class="${wireLeakTraps.length ? 'bad' : ''}"><b>${wireLeakTraps.length}</b></td></tr>
      <tr><td>False positives (traps)</td><td>${fpTraps.length}</td></tr>
      <tr><td>Missed (traps)</td><td>${missTraps.length}</td></tr>
      <tr><td>Privileged mismatch</td><td>${privMismatch.length}</td></tr>
      <tr><td>Inference latency</td><td>median <b>${lat.median.toFixed(0)}ms</b> · p95 ${lat.p95.toFixed(0)}ms · max ${lat.max.toFixed(0)}ms · mean ${lat.mean.toFixed(0)}ms</td></tr>
      <tr><td>Total run time</td><td>${elapsedS.toFixed(1)}s for ${results.length} traps</td></tr>
      <tr><td>By category</td><td>${Object.entries(byCategory).map(([c, b]) => `${c}: ${b.pass}/${b.total}`).join(' · ')}</td></tr>
    </table>`;

  const failures = results.filter((r) => !r.pass);
  tableEl.innerHTML = failures.length
    ? `<h3>${failures.length} failing traps</h3><table class="grid">
        <thead><tr><th>id</th><th>category</th><th>issue</th><th>detail</th><th>minNameScore</th></tr></thead>
        <tbody>${failures.map((r) => {
          const issues: string[] = [];
          if (r.wireLeaks.length) issues.push('WIRE-LEAK');
          if (r.missed.length) issues.push('missed');
          if (r.falsePositives.length) issues.push('false-pos');
          if (r.privilegedExpected !== undefined && r.privilegedExpected !== r.privilegedActual) issues.push('priv');
          const detail = [
            ...r.wireLeaks.map((l) => `leak:${JSON.stringify(l.value)}`),
            ...r.missed.map((m) => `miss ${m.category}:${JSON.stringify(m.value)} (${(m.overlapFrac * 100).toFixed(0)}%)`),
            ...r.falsePositives.map((f) => `fp:${JSON.stringify(f.substr)}`),
          ].join('; ');
          return `<tr><td>${r.id}</td><td>${r.category}</td><td class="bad">${issues.join(',')}</td><td>${detail}</td><td>${r.minNameScore?.toFixed(3) ?? '—'}</td></tr>`;
        }).join('')}</tbody></table>`
    : `<p class="ok">No failing traps. 🎉</p>`;

  lastReport = {
    generated_at: new Date().toISOString(),
    variant: engine.variant,
    provider: engine.provider,
    userAgent: navigator.userAgent,
    manifest_version: (manifest as any).manifest_version,
    totals: { total: results.length, pass: passCount, wire_leaks: wireLeakTraps.length, false_positives: fpTraps.length, missed: missTraps.length, privileged_mismatch: privMismatch.length },
    latency_ms: lat,
    elapsed_seconds: Number(elapsedS.toFixed(1)),
    by_category: byCategory,
    failures: failures.map((r) => ({ id: r.id, category: r.category, missed: r.missed, falsePositives: r.falsePositives, wireLeaks: r.wireLeaks, privilegedExpected: r.privilegedExpected, privilegedActual: r.privilegedActual, minNameScore: r.minNameScore })),
  };
  ($('downloadBtn') as HTMLButtonElement).disabled = false;

  setStatus(`Done. ${zeroLeak ? '✅ ZERO LEAK' : '⚠ FAIL'} — ${passCount}/${results.length} pass, ${wireLeakTraps.length} wire leaks, median ${lat.median.toFixed(0)}ms.`);
  runBtn.disabled = false; loadBtn.disabled = false;
};

($('downloadBtn') as HTMLButtonElement).onclick = () => {
  if (!lastReport) return;
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `browser-gliner-report-${engine.variant}-${engine.provider}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// DEBUG hooks for the headless driver / console.
(window as any).__engine = engine;
(window as any).__detect = (t: string) => engine.detect(t);
(window as any).__detectRaw = (t: string, thr?: number, ents?: string[]) => engine.detectRaw(t, thr, ents);

setStatus(`Ready. ${traps.length} traps loaded from manifest. Pick a variant + provider, then Load model.`);
