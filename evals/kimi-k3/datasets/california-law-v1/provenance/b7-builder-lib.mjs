/**
 * b7-builder-lib.mjs
 *
 * WHAT THIS DOES
 * --------------
 * Deterministic synthetic case-file engine for batch B7 (long_context) of the
 * california-law-v1 evaluation dataset. Given a fixed integer seed and a
 * section plan, it emits a multi-thousand-word litigation packet built from
 * the template pools in b7-lib-pools.mjs: a caption, an exhibit index,
 * attorney correspondence, declarations, billing records, account ledgers,
 * deposition excerpts, discovery responses, minute orders, and e-mail.
 * Legally operative facts are supplied by the caller as "inserts" and are
 * spliced into a designated section at a caller-specified fractional depth,
 * so the fact a task grades on is buried at a controlled position.
 *
 * Everything the engine emits is invented. No real party, firm, court,
 * account, or matter is described, and nothing here states a proposition of
 * law: graded propositions are sliced from registered primary sources by the
 * task builder (b7-builder.mjs).
 *
 * INPUT FILES (absolute paths)
 *  - ./b7-lib-pools.mjs (sibling module; template pools)
 *
 * OUTPUT FILES: none (module).
 *
 * DETERMINISM
 *  - mulberry32 PRNG seeded per task; no Date.now(), no Math.random().
 *  - Identical seed + identical plan => byte-identical packet.
 */

import {
  LETTER_BODY,
  DECL_PARA,
  BILL_NARRATIVE,
  LEDGER_DESC,
  DEPO_QA,
  DISCOVERY_RESP,
  EXHIBIT_DESC,
  EMAIL_BODY,
  MINUTE_BODY,
} from './b7-lib-pools.mjs';

/* ------------------------------------------------------------------ *
 * deterministic primitives
 * ------------------------------------------------------------------ */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

export const countWords = (s) => (s.match(/\S+/gu) || []).length;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_MS = 86400000;
export const day = (y, m, d) => Date.UTC(y, m - 1, d);
export const addDays = (t, n) => t + n * DAY_MS;
export const longDate = (t) => {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};
export const shortDate = (t) => {
  const d = new Date(t);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

const money = (n) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ------------------------------------------------------------------ *
 * token substitution
 * ------------------------------------------------------------------ */

const SETS = ['One', 'Two', 'Three', 'Four'];

function makeFiller(rng, ctx, state) {
  return function fill(tpl) {
    const cache = {};
    return tpl.replace(/#[A-Z0-9]+#/gu, (token) => {
      if (cache[token] !== undefined) return cache[token];
      let value;
      switch (token) {
        case '#DATE#':
          state.cursor = addDays(state.cursor, int(rng, 1, 9));
          value = longDate(state.cursor);
          break;
        case '#SDATE#':
          state.cursor = addDays(state.cursor, int(rng, 1, 9));
          value = shortDate(state.cursor);
          break;
        case '#EX#':
          state.exhibit += 1;
          value = `EX. ${String(state.exhibit).padStart(4, '0')}`;
          break;
        case '#BATES#': {
          const start = state.bates;
          state.bates += int(rng, 2, 14);
          value = `${ctx.bates}-${String(start).padStart(6, '0')} through ${ctx.bates}-${String(state.bates).padStart(6, '0')}`;
          break;
        }
        case '#N#': value = String(int(rng, 2, 29)); break;
        case '#N2#': value = String(int(rng, 30, 68)); break;
        case '#ACCT#': value = String(int(rng, 1000, 9999)); break;
        case '#SET#': value = pick(rng, SETS); break;
        case '#PET#': value = ctx.petitioner; break;
        case '#RES#': value = ctx.respondent; break;
        case '#PC#': value = ctx.petCounsel; break;
        case '#RC#': value = ctx.resCounsel; break;
        default: value = '';
      }
      cache[token] = value;
      return value;
    });
  };
}

/* ------------------------------------------------------------------ *
 * section generators
 * ------------------------------------------------------------------ */

const RULE = '-'.repeat(78);

const GENERATORS = {
  exhibits(rng, ctx, state, fill) {
    const rows = [];
    for (let i = 0; i < 10; i += 1) {
      state.exhibit += 1;
      const start = state.bates;
      state.bates += int(rng, 2, 11);
      state.cursor = addDays(state.cursor, int(rng, 1, 12));
      rows.push(
        `EX. ${String(state.exhibit).padStart(4, '0')}  |  ${shortDate(state.cursor)}  |  ${fill(pick(rng, EXHIBIT_DESC))}  |  Bates ${ctx.bates}-${String(start).padStart(6, '0')} through ${ctx.bates}-${String(state.bates).padStart(6, '0')}`,
      );
    }
    return rows.join('\n');
  },

  correspondence(rng, ctx, state, fill) {
    state.cursor = addDays(state.cursor, int(rng, 2, 11));
    state.letter += 1;
    const outbound = state.letter % 2 === 1;
    const from = outbound ? ctx.petCounsel : ctx.resCounsel;
    const fromFirm = outbound ? ctx.petFirm : ctx.resFirm;
    const to = outbound ? ctx.resCounsel : ctx.petCounsel;
    const toFirm = outbound ? ctx.resFirm : ctx.petFirm;
    const paras = [];
    const n = int(rng, 2, 4);
    for (let i = 0; i < n; i += 1) paras.push(fill(pick(rng, LETTER_BODY)));
    return [
      RULE,
      `CORRESPONDENCE ITEM ${String(state.letter).padStart(3, '0')}`,
      `${fromFirm}`,
      `${longDate(state.cursor)}`,
      ``,
      `${to}`,
      `${toFirm}`,
      ``,
      `Re:  ${ctx.caption}`,
      `     ${ctx.court}, Case No. ${ctx.caseNo}`,
      `Via: ${pick(rng, ['Electronic mail', 'Electronic mail and U.S. Mail', 'U.S. Mail', 'Overnight courier'])}`,
      ``,
      `Dear Counsel:`,
      ``,
      paras.join('\n\n'),
      ``,
      `Very truly yours,`,
      ``,
      `${from}`,
      `${fromFirm}`,
    ].join('\n');
  },

  declaration(rng, ctx, state, fill) {
    const lines = [];
    for (let i = 0; i < 5; i += 1) {
      state.para += 1;
      lines.push(`${state.para}.  ${fill(pick(rng, DECL_PARA))}`);
    }
    return lines.join('\n\n');
  },

  billing(rng, ctx, state, fill) {
    const lines = [];
    for (let i = 0; i < 12; i += 1) {
      state.cursor = addDays(state.cursor, int(rng, 0, 4));
      const tk = pick(rng, ctx.timekeepers);
      const hours = int(rng, 1, 34) / 10;
      const amount = hours * tk.rate;
      lines.push(
        `${shortDate(state.cursor)}  ${tk.initials}  ${fill(pick(rng, BILL_NARRATIVE))}  |  ${hours.toFixed(1)} hr  |  ${money(tk.rate)}/hr  |  ${money(amount)}`,
      );
    }
    return lines.join('\n');
  },

  ledger(rng, ctx, state, fill) {
    const lines = [];
    for (let i = 0; i < 20; i += 1) {
      state.cursor = addDays(state.cursor, int(rng, 0, 3));
      const credit = rng() < 0.22;
      const amt = credit ? int(rng, 90000, 940000) / 100 : int(rng, 1200, 480000) / 100;
      state.balance += credit ? amt : -amt;
      lines.push(
        `${shortDate(state.cursor)}   ${fill(pick(rng, LEDGER_DESC)).padEnd(42, ' ')}  ${(credit ? '' : '-') + amt.toFixed(2)}   ${state.balance.toFixed(2)}`,
      );
    }
    return lines.join('\n');
  },

  depo(rng, ctx, state, fill) {
    const lines = [];
    for (let i = 0; i < 8; i += 1) {
      const [q, a] = pick(rng, DEPO_QA);
      state.depoPage += rng() < 0.34 ? 1 : 0;
      state.depoLine += int(rng, 3, 9);
      if (state.depoLine > 25) { state.depoLine -= 25; state.depoPage += 1; }
      lines.push(
        `[${state.depoPage}:${String(state.depoLine).padStart(2, '0')}]  Q.  ${q}\n           A.  ${a}`,
      );
    }
    return lines.join('\n\n');
  },

  discovery(rng, ctx, state, fill) {
    const lines = [];
    for (let i = 0; i < 3; i += 1) {
      state.rog += 1;
      const [q, a] = pick(rng, DISCOVERY_RESP);
      lines.push(
        `INTERROGATORY NO. ${state.rog}:\n${fill(q)}\n\nRESPONSE TO INTERROGATORY NO. ${state.rog}:\n${fill(a)}`,
      );
    }
    return lines.join('\n\n');
  },

  minutes(rng, ctx, state, fill) {
    state.cursor = addDays(state.cursor, int(rng, 6, 40));
    return [
      RULE,
      `MINUTE ORDER`,
      `${ctx.court}   Department ${int(rng, 2, 44)}`,
      `${ctx.caption} — Case No. ${ctx.caseNo}`,
      `Date: ${longDate(state.cursor)}`,
      ``,
      fill(pick(rng, MINUTE_BODY)),
    ].join('\n');
  },

  emails(rng, ctx, state, fill) {
    state.cursor = addDays(state.cursor, int(rng, 0, 5));
    const outbound = rng() < 0.5;
    return [
      `From: ${outbound ? ctx.petCounsel : ctx.resCounsel}`,
      `To: ${outbound ? ctx.resCounsel : ctx.petCounsel}`,
      `Sent: ${longDate(state.cursor)} ${int(rng, 8, 17)}:${String(int(rng, 0, 59)).padStart(2, '0')}`,
      `Subject: ${ctx.caseNo} — ${pick(rng, ['status', 'scheduling', 'production', 'exhibits', 'stipulation', 'calendar'])}`,
      ``,
      fill(pick(rng, EMAIL_BODY)),
    ].join('\n');
  },
};

const SECTION_TITLES = {
  exhibits: 'EXHIBIT INDEX (CONTINUED)',
  correspondence: 'CORRESPONDENCE FILE',
  declaration: 'DECLARATION — CONTINUED PARAGRAPHS',
  billing: 'ATTORNEY TIME AND BILLING DETAIL',
  ledger: 'ACCOUNT LEDGER DETAIL',
  depo: 'DEPOSITION TRANSCRIPT EXCERPTS',
  discovery: 'RESPONSES TO INTERROGATORIES',
  minutes: 'MINUTE ORDERS AND CALENDAR NOTES',
  emails: 'COUNSEL E-MAIL THREAD',
};

/* ------------------------------------------------------------------ *
 * packet assembly
 * ------------------------------------------------------------------ */

export function buildPacket(seed, ctx, plan) {
  const rng = mulberry32(seed);
  const state = {
    cursor: ctx.fileStart,
    exhibit: 100,
    bates: 1000,
    letter: 0,
    para: 0,
    rog: 0,
    depoPage: 12,
    depoLine: 4,
    balance: 48213.77,
  };
  const fill = makeFiller(rng, ctx, state);

  const head = [
    '='.repeat(78),
    `CONSOLIDATED LITIGATION FILE — SYNTHETIC TRAINING PACKET`,
    `${ctx.court}`,
    `${ctx.caption}`,
    `Case No. ${ctx.caseNo}`,
    `Counsel for Petitioner: ${ctx.petCounsel}, ${ctx.petFirm}`,
    `Counsel for Respondent: ${ctx.resCounsel}, ${ctx.resFirm}`,
    `File assembled: ${longDate(ctx.fileStart)}`,
    `All parties, facts, documents, account numbers, and events in this packet`,
    `are invented for evaluation purposes. Any resemblance to an actual matter`,
    `is unintended.`,
    '='.repeat(78),
    '',
    'SECTION GUIDE',
    ...plan.map((s, i) => `  ${String(i + 1).padStart(2, '0')}.  ${s.label ?? SECTION_TITLES[s.kind]}`),
  ].join('\n');

  const parts = [head];
  for (const section of plan) {
    const blocks = [];
    let words = 0;
    let guard = 0;
    while (words < section.words && guard < 100000) {
      const block = GENERATORS[section.kind](rng, ctx, state, fill);
      blocks.push(block);
      words += countWords(block);
      guard += 1;
    }
    for (const insert of section.inserts ?? []) {
      const at = Math.min(
        blocks.length,
        Math.max(0, Math.round(insert.frac * blocks.length)),
      );
      blocks.splice(at, 0, insert.text.trim());
    }
    parts.push(
      [
        '',
        '='.repeat(78),
        section.label ?? SECTION_TITLES[section.kind],
        '='.repeat(78),
        '',
        blocks.join('\n\n'),
      ].join('\n'),
    );
  }
  return parts.join('\n');
}
