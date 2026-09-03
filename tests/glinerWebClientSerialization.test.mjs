/**
 * =============================================================================
 * FILE: tests/glinerWebClientSerialization.test.mjs
 * =============================================================================
 *
 * WHAT THIS DOES:
 *   Regression test for the 2026-09-03 "Session already started" outage.
 *   onnxruntime-web's WebGPU backend is not reentrant; overlapping
 *   detectSpans() calls (live preview + send) must be serialized by
 *   glinerWebClient so the wire path never fails closed on a collision.
 *
 *   Injects a fake engine that throws exactly the way ORT does when a
 *   second inference starts while one is in flight, then fires many
 *   concurrent detectSpans() calls and asserts they all resolve in order.
 *
 * INPUT FILES:  none (pure in-memory; no model download)
 * OUTPUT FILES: none
 *
 * USAGE:
 *   ./node_modules/.bin/tsx tests/glinerWebClientSerialization.test.mjs
 * =============================================================================
 */
import assert from 'node:assert/strict';
import { detectSpans, setEngineOverrideForTest } from '../services/sanitization/glinerWebClient.ts';

let inFlight = 0;
let maxInFlight = 0;
const order = [];

const fakeEngine = {
  async inference({ texts }) {
    if (inFlight > 0) throw new Error('Session already started'); // ORT JSEP behaviour
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 15));
    order.push(texts[0]);
    inFlight--;
    return [[]];
  },
};

setEngineOverrideForTest(fakeEngine);

// Simulate the real collision: preview debounce + Enter + drafting fan-out.
const inputs = Array.from({ length: 12 }, (_, i) => `call ${i} for Mary Smith`);
const results = await Promise.all(inputs.map((t) => detectSpans(t)));

assert.equal(results.length, 12, 'every call resolved');
assert.equal(maxInFlight, 1, `inference overlapped (max in flight ${maxInFlight})`);
assert.deepEqual(order, inputs, 'calls ran in submission order');

// A failing inference must not poison the queue for later callers.
setEngineOverrideForTest({ async inference() { throw new Error('boom'); } });
await assert.rejects(detectSpans('x'), /boom/);
setEngineOverrideForTest(fakeEngine);
const after = await detectSpans('after failure');
assert.equal(after.modelLoaded, true, 'queue drained after a failed run');

setEngineOverrideForTest(null);
console.log('glinerWebClientSerialization: 5 assertions passed, 0 failed');
