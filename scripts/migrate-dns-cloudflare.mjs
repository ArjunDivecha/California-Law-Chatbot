/**
 * =============================================================================
 * migrate-dns-cloudflare.mjs — dancingelephant.ai zone migration to Cloudflare
 * =============================================================================
 *
 * WHAT THIS DOES:
 * Creates the dancingelephant.ai zone in Cloudflare and populates it with the
 * complete record set captured from the register.com nameservers on 2026-08-18
 * (via DNS-over-HTTPS, dns.google), so the zone can be cut over by changing
 * nameservers at Network Solutions. Motivation: register.com's nameservers
 * (dns101/dns102.register.com) intermittently SERVFAIL (observed on
 * Cloudflare's 1.1.1.1 resolver for MX/TXT/www lookups, 2026-08-18).
 *
 * EVERY record is created with proxied=false (DNS-only / grey cloud):
 *  - apex + www must stay unproxied for Vercel's routing and cert issuance;
 *  - mail records (MX targets, imap/pop/smtp/mail CNAMEs) must never be
 *    proxied or mail breaks.
 *
 * Idempotent: safe to re-run — finds the existing zone, upserts records by
 * (type, name) and leaves matching ones alone.
 *
 * INPUT:
 *  - /Users/arjundivecha/Dropbox/AAA Backup/.env.txt (CLOUDFLARE_API_TOKEN;
 *    first occurrence wins). No other file I/O.
 *
 * OUTPUT (stdout only, no files):
 *  - per-record create/update/ok lines
 *  - the two Cloudflare-assigned nameservers to enter at Network Solutions
 *
 * USAGE:  node scripts/migrate-dns-cloudflare.mjs
 *
 * AFTER RUNNING: change the domain's nameservers at Network Solutions to the
 * two printed Cloudflare nameservers. Mail, Vercel, and all subdomains keep
 * working through the switch because the record sets are identical.
 * =============================================================================
 */
import { readFileSync } from 'node:fs';

const ZONE = 'dancingelephant.ai';
const API = 'https://api.cloudflare.com/client/v4';

// --- the zone, verbatim from the register.com capture (2026-08-18) ----------
const RECORDS = [
  { type: 'A', name: ZONE, content: '76.76.21.21', ttl: 3600 },
  { type: 'CNAME', name: `www.${ZONE}`, content: 'cname.vercel-dns.com', ttl: 3600 },
  { type: 'MX', name: ZONE, content: 'mx001.register.xion.oxcs.net', priority: 10, ttl: 3600 },
  { type: 'MX', name: ZONE, content: 'mx002.register.xion.oxcs.net', priority: 10, ttl: 3600 },
  { type: 'MX', name: ZONE, content: 'mx003.register.xion.oxcs.net', priority: 10, ttl: 3600 },
  { type: 'MX', name: ZONE, content: 'mx004.register.xion.oxcs.net', priority: 10, ttl: 3600 },
  { type: 'TXT', name: ZONE, content: '"v=spf1 include:spf.registeredsite.com include:spf.cloudus.oxcs.net ~all"', ttl: 3600 },
  {
    type: 'SRV', name: `_autodiscover._tcp.${ZONE}`, ttl: 3600,
    data: { priority: 10, weight: 10, port: 443, target: 'autodiscover.hostingplatform.com' },
  },
  { type: 'CNAME', name: `autodiscover.${ZONE}`, content: 'autodiscover.hostingplatform.com', ttl: 3600 },
  { type: 'CNAME', name: `imap.${ZONE}`, content: `imap.${ZONE}.registermail.net`, ttl: 3600 },
  { type: 'CNAME', name: `mail.${ZONE}`, content: `mail.${ZONE}.registermail.net`, ttl: 3600 },
  { type: 'CNAME', name: `pop.${ZONE}`, content: `pop.${ZONE}.registermail.net`, ttl: 3600 },
  { type: 'CNAME', name: `smtp.${ZONE}`, content: `smtp.${ZONE}.registermail.net`, ttl: 3600 },
];

// --- auth --------------------------------------------------------------------
const env = readFileSync('/Users/arjundivecha/Dropbox/AAA Backup/.env.txt', 'utf8');
const token = env.match(/^CLOUDFLARE_API_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) { console.error('FAIL: CLOUDFLARE_API_TOKEN not found in .env.txt'); process.exit(1); }

async function cf(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${path}: ${JSON.stringify(json.errors)}`);
  return json.result;
}

// --- zone --------------------------------------------------------------------
let zone = (await cf('GET', `/zones?name=${ZONE}`))[0];
if (zone) {
  console.log(`zone exists: ${zone.id} (status: ${zone.status})`);
} else {
  const accounts = await cf('GET', '/accounts');
  if (!accounts.length) throw new Error('token can list no accounts — needs Zone:Edit + Account scope');
  zone = await cf('POST', '/zones', { name: ZONE, account: { id: accounts[0].id }, type: 'full' });
  console.log(`zone created: ${zone.id} under account "${accounts[0].name}"`);
}

// --- records (upsert by type+name, DNS-only) ----------------------------------
const existing = await cf('GET', `/zones/${zone.id}/dns_records?per_page=100`);
for (const r of RECORDS) {
  const payload = { ...r, proxied: false };
  const match = existing.filter((e) => e.type === r.type && e.name === r.name);
  const same = match.find((e) =>
    r.type === 'SRV'
      ? e.data?.target === r.data.target && e.data?.port === r.data.port
      : e.content.replace(/"/g, '') === (r.content ?? '').replace(/"/g, '') &&
        (r.priority === undefined || e.priority === r.priority),
  );
  if (same) { console.log(`ok      ${r.type} ${r.name}`); continue; }
  // MX/TXT can legitimately have multiple records per name — always create.
  // Singleton types (A/CNAME/SRV) with a different value get updated in place.
  if (match.length && !['MX', 'TXT'].includes(r.type)) {
    await cf('PUT', `/zones/${zone.id}/dns_records/${match[0].id}`, payload);
    console.log(`updated ${r.type} ${r.name} -> ${r.content ?? r.data.target}`);
  } else {
    await cf('POST', `/zones/${zone.id}/dns_records`, payload);
    console.log(`created ${r.type} ${r.name} -> ${r.content ?? r.data.target}`);
  }
}

console.log('\n=== NEXT STEP (manual, at Network Solutions) ===');
console.log(`Set nameservers for ${ZONE} to:`);
for (const ns of zone.name_servers ?? []) console.log(`  ${ns}`);
console.log(`Zone status is "${zone.status}" — flips to "active" once Cloudflare sees the NS change.`);
