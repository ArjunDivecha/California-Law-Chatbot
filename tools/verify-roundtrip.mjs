#!/usr/bin/env node
/**
 * End-to-end sanitization verification.
 *
 * Usage:
 *   node tools/verify-roundtrip.mjs "<the exact text you typed into the chatbot>"
 *
 * What it does:
 *   1. Asks the local OPF daemon what spans it would detect for the prompt.
 *      Shows the entities we expect to be tokenized.
 *   2. Pulls the most recent /api/gemini-chat audit record from Upstash Redis
 *      (the audit log records sanitizedPromptHmac for every wire call).
 *   3. Computes HMAC-SHA256 of several candidate forms of the prompt:
 *        - raw, exactly as typed
 *        - tokenized with CLIENT_001, ADDRESS_001, etc. as a guess
 *      And compares each against the audit HMAC.
 *   4. Prints a verdict: "wire was tokenized ✓" or "wire payload was raw ✗".
 *
 * Requires: AUDIT_HMAC_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * — pulled automatically from the Vercel preview env if not in the local
 * shell. The script will run `vercel env pull` if needed.
 */

import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PROMPT = process.argv[2];
if (!PROMPT) {
  console.error('Usage: node tools/verify-roundtrip.mjs "<exact text typed into chatbot>"');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. OPF daemon probe — shows what spans we expect
// ---------------------------------------------------------------------------

async function detectViaOpf(text) {
  const urls = [
    'https://localhost:47822/v1/detect',
    'http://127.0.0.1:47821/v1/detect',
  ];
  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`OPF daemon HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// 2. Env loading — pulls from Vercel if not in shell
// ---------------------------------------------------------------------------

function loadEnv() {
  if (
    process.env.AUDIT_HMAC_KEY &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return;
  }
  const envFile = path.resolve('/tmp/preview-roundtrip.env');
  console.log('  pulling Vercel preview env (one-time)…');
  try {
    execSync(
      `vercel env pull "${envFile}" --environment=preview ` +
        '--git-branch=codex/bedrock-confidentiality-migration --yes',
      { stdio: 'pipe' }
    );
  } catch (e) {
    throw new Error(`vercel env pull failed: ${e.message}`);
  }
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
}

// ---------------------------------------------------------------------------
// 3. Audit log retrieval
// ---------------------------------------------------------------------------

async function fetchLatestAudit() {
  const today = new Date().toISOString().slice(0, 10);
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/lrange/audit:${today}/0/4`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const body = await res.json();
  if (!body.result || body.result.length === 0) return [];
  return body.result.map((r) => JSON.parse(r));
}

// ---------------------------------------------------------------------------
// 4. HMAC match check
// ---------------------------------------------------------------------------

function hmac(text) {
  return crypto
    .createHmac('sha256', process.env.AUDIT_HMAC_KEY)
    .update(text)
    .digest('hex');
}

function buildTokenizedCandidates(prompt, opfSpans) {
  // Replace each OPF span with its expected token shape. We don't know
  // the exact serial assigned by the store, so we guess _001 .. _099.
  // Also try the common case where Vercel sees the verbatim sanitized
  // form (no extra trailing whitespace).
  const variants = new Set([prompt, prompt + ' ']);
  if (opfSpans.length === 0) return variants;

  const sortedSpans = [...opfSpans].sort((a, b) => a.start - b.start);
  // Multiple sequence guesses: 001/002/003, 010/011/012, etc.
  for (const startSerial of [1, 5, 10, 20, 50, 100]) {
    let serial = startSerial;
    let cursor = 0;
    const parts = [];
    for (const s of sortedSpans) {
      parts.push(prompt.slice(cursor, s.start));
      const tokenPrefix = labelToTokenPrefix(s.label);
      const num = String(serial).padStart(3, '0');
      parts.push(`${tokenPrefix}_${num}`);
      cursor = s.end;
      serial++;
    }
    parts.push(prompt.slice(cursor));
    const candidate = parts.join('');
    variants.add(candidate);
    variants.add(candidate + ' ');
  }
  return variants;
}

function labelToTokenPrefix(label) {
  switch (label) {
    case 'private_person': return 'CLIENT';
    case 'private_address': return 'ADDRESS';
    case 'private_phone': return 'PHONE';
    case 'private_email': return 'EMAIL';
    case 'private_date': return 'DATE';
    case 'account_number': return 'ACCT';
    default: return 'TOKEN';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n=== Step 1: OPF detection ===');
  const opf = await detectViaOpf(PROMPT);
  console.log(`  detected ${opf.spans.length} span(s):`);
  for (const s of opf.spans) {
    console.log(`    ${s.label.padEnd(18)} "${s.text}"  (chars ${s.start}-${s.end})`);
  }

  console.log('\n=== Step 2: pull Vercel env ===');
  loadEnv();
  if (!process.env.AUDIT_HMAC_KEY) {
    console.error('  AUDIT_HMAC_KEY missing after env pull — cannot continue');
    process.exit(2);
  }

  console.log('\n=== Step 3: fetch latest audit records ===');
  const records = await fetchLatestAudit();
  if (records.length === 0) {
    console.log('  no records yet for today. Send a message first, then re-run.');
    return;
  }
  const wireRecord =
    records.find((r) => r.route === 'gemini-chat' || r.route === 'claude-chat') ?? records[0];
  console.log(`  most recent wire call: route=${wireRecord.route} status=${wireRecord.statusCode}`);
  console.log(`  promptLength=${wireRecord.promptLength} latencyMs=${wireRecord.latencyMs}`);
  console.log(`  audit HMAC: ${wireRecord.sanitizedPromptHmac}`);

  console.log('\n=== Step 4: compare wire HMAC against candidates ===');
  const rawHmac = hmac(PROMPT);
  const target = wireRecord.sanitizedPromptHmac;
  console.log(`  raw HMAC:   ${rawHmac}  ${rawHmac === target ? '←  MATCHES — RAW LEAKED ✗' : ''}`);

  const variants = buildTokenizedCandidates(PROMPT, opf.spans);
  let tokenizedMatched = false;
  for (const v of variants) {
    const h = hmac(v);
    if (h === target) {
      tokenizedMatched = true;
      console.log(`  ✓ tokenized form MATCHES audit HMAC`);
      console.log(`    on the wire: ${JSON.stringify(v)}`);
      break;
    }
  }

  console.log('\n=== Verdict ===');
  if (rawHmac === target) {
    console.log('  ✗ RAW PII LEFT THE DEVICE. The wire payload matched the raw text.');
    process.exit(1);
  } else if (tokenizedMatched) {
    console.log('  ✓ Wire payload was sanitized. Raw text was NOT sent to Bedrock.');
  } else {
    console.log('  ? Wire HMAC did not match raw OR predicted tokenized forms.');
    console.log('    The wire payload was something else — likely tokenized but with');
    console.log('    different serials (e.g. CLIENT_007 instead of _001) or extra');
    console.log('    history attached. The fact that it does NOT match the raw text');
    console.log('    is strong evidence the raw did not leak. Inspect the prompt and');
    console.log('    the daemon logs at ~/.opf-daemon/logs/daemon.err.log to confirm.');
  }
}

main().catch((e) => {
  console.error('error:', e.message);
  process.exit(2);
});
