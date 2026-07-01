/**
 * =============================================================================
 * FILE: traps-verify.ts  (DEV-ONLY integration verification harness)
 * =============================================================================
 *
 * WHAT THIS DOES (plain language):
 *   Runs the REAL production sanitization function `detectPii()` over all 120
 *   traps, in the browser, with VITE_DETECTOR=web so detection is performed by
 *   the in-browser GLiNER engine (glinerWebClient). It scores each trap with
 *   the same input-phase criteria as tests/traps/runTrapsWire.mjs:
 *     (a) every must_redact value >=50% covered by a span of its category,
 *     (b) no must_not_redact substring falsely flagged,
 *     (c) no must_redact raw value survives the synthesized wire body,
 *     (d) privileged flag matches expected.
 *   It also asserts usedOpf===true on every trap, proving the WEB ENGINE
 *   (not the heuristic fallback) actually produced the detections.
 *
 *   This exercises the actual production code path end-to-end through the new
 *   flag — the definitive integration test. It is NOT shipped: it's a root
 *   dev page served only by `vite` in dev. Delete traps-verify.{html,ts} to
 *   remove.
 *
 * INPUT FILES:  ./tests/traps/manifest-v1.json (read-only import)
 * OUTPUT FILES: none on disk (renders to DOM; results also on window.__results)
 * =============================================================================
 */
import { detectPii } from './services/sanitization/detectionPipeline.ts';
import { HIGH_RISK_CATEGORIES, type Span } from './api/_shared/sanitization/index.ts';
import { warmup, getActiveProvider } from './services/sanitization/glinerWebClient.ts';
import manifest from './tests/traps/manifest-v1.json';

interface Trap {
  id: string; category: string; w_item?: string; input: string;
  must_redact?: { value: string; category: string }[];
  must_not_redact?: string[];
  expected_privileged?: boolean;
}
const traps = (manifest as { traps: Trap[] }).traps;

function overlapLen(a: [number, number], b: [number, number]) {
  return Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
}
function isCovered(spans: Span[], value: string, category: string, text: string) {
  const idx = text.indexOf(value);
  if (idx < 0) return { covered: false, frac: 0 };
  const range: [number, number] = [idx, idx + value.length];
  let overlap = 0;
  for (const sp of spans) if (sp.category === category) overlap += overlapLen([sp.start, sp.end], range);
  const frac = overlap / value.length;
  return { covered: frac >= 0.5, frac };
}
function findViolation(spans: Span[], substr: string, text: string) {
  const idx = text.indexOf(substr);
  if (idx < 0) return false;
  const range: [number, number] = [idx, idx + substr.length];
  return spans.some((sp) => sp.start >= range[0] && sp.end <= range[1]);
}
function buildWireBody(text: string, spans: Span[]) {
  const hr = spans.filter((s) => HIGH_RISK_CATEGORIES.has(s.category)).sort((a, b) => b.start - a.start);
  let out = text;
  for (const sp of hr) out = out.slice(0, sp.start) + `${sp.category.toUpperCase()}_TOKEN` + out.slice(sp.end);
  return out;
}

const statusEl = document.getElementById('status')!;
const outEl = document.getElementById('out')!;
const set = (s: string) => { statusEl.textContent = s; };

(window as any).runVerify = async function runVerify() {
  set('Warming up in-browser GLiNER (first run downloads ~1.1GB fp32)…');
  await warmup();
  set(`Model loaded on provider=${getActiveProvider()}. Running ${traps.length} traps through real detectPii…`);

  const results: any[] = [];
  const latencies: number[] = [];
  const t0 = performance.now();
  for (let i = 0; i < traps.length; i++) {
    const trap = traps[i];
    const r0 = performance.now();
    const det = await detectPii(trap.input, 'best-effort');
    latencies.push(performance.now() - r0);
    const spans = det.spans ?? [];

    const missed = (trap.must_redact ?? []).filter((e) => !isCovered(spans, e.value, e.category, trap.input).covered);
    const fps = (trap.must_not_redact ?? []).filter((s) => findViolation(spans, s, trap.input));
    const wire = buildWireBody(trap.input, spans);
    const leaks = (trap.must_redact ?? []).filter((e) => wire.includes(e.value));
    const privOk = trap.expected_privileged === undefined || Boolean(det.privileged) === Boolean(trap.expected_privileged);
    const pass = missed.length === 0 && fps.length === 0 && leaks.length === 0 && privOk;
    // For failing traps, capture the spans that explain the failure.
    const offending = !pass
      ? spans.map((s) => ({ c: s.category, l: s.label, r: s.raw, s: s.start, e: s.end }))
      : undefined;
    results.push({ id: trap.id, category: trap.category, pass, usedOpf: det.usedOpf,
      missed, fps: fps, leaks, privExpected: trap.expected_privileged, privActual: det.privileged, spans: offending, input: !pass ? trap.input : undefined });
    if ((i + 1) % 10 === 0 || i === traps.length - 1) {
      set(`Running… ${i + 1}/${traps.length} (${results.filter((x) => x.pass).length} pass)`);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const elapsedS = (performance.now() - t0) / 1000;
  const sorted = [...latencies].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const passCount = results.filter((r) => r.pass).length;
  const leakCount = results.filter((r) => r.leaks.length).length;
  const heuristicFallbacks = results.filter((r) => !r.usedOpf).length;
  const zero = passCount === results.length && leakCount === 0 && heuristicFallbacks === 0;

  (window as any).__results = { passCount, total: results.length, leakCount, heuristicFallbacks, provider: getActiveProvider(), medianMs: med, elapsedS, failures: results.filter((r) => !r.pass) };
  set(`${zero ? '✅ ZERO LEAK' : '⚠ FAIL'} — ${passCount}/${results.length} pass · ${leakCount} wire leaks · heuristicFallbacks=${heuristicFallbacks} · provider=${getActiveProvider()} · median ${med.toFixed(0)}ms · ${elapsedS.toFixed(1)}s`);
  const fails = results.filter((r) => !r.pass);
  outEl.innerHTML = fails.length
    ? '<h3>Failures</h3>' + fails.map((r) => `<div>${r.id} [${r.category}] usedOpf=${r.usedOpf} ${r.leaks.length ? 'LEAK:' + JSON.stringify(r.leaks.map((l: any) => l.value)) : ''} ${r.missed.length ? 'miss:' + JSON.stringify(r.missed.map((m: any) => m.category + ':' + m.value)) : ''} ${r.fps.length ? 'fp:' + JSON.stringify(r.fps) : ''} ${r.privExpected !== undefined && r.privActual !== r.privExpected ? `priv ${r.privExpected}->${r.privActual}` : ''}</div>`).join('')
    : '<p style="color:#047857;font-weight:700">No failing traps. 🎉</p>';
};

set(`Ready. ${traps.length} traps. Click Run (VITE_DETECTOR must be "web").`);
