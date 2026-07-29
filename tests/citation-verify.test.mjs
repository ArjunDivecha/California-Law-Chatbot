import { strict as assert } from 'node:assert';

const {
  citationVerify,
  clearCiteLawVerificationCache,
  extractCitations,
  parseCaseCitationIdentity,
  prefetchCiteLawVerification,
} = await import('../api/_lib/tools/citationVerify.ts');

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ name, message: error?.message ?? String(error) });
    console.log(`❌ ${name}\n   ${error?.message ?? error}`);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function courtListenerHit(title, citation) {
  return {
    id: 123,
    case_name: title,
    citation: [citation],
    absolute_url: '/opinion/123/example/',
    court: 'Cal.',
    date_filed: '2002-08-01',
  };
}

async function withProviders(
  { courtListenerResults = [], citeLawResults = [], citeLawStatus = 200, billing },
  fn,
) {
  const priorFetch = globalThis.fetch;
  const priorCourtListenerKey = process.env.COURTLISTENER_API_KEY;
  const priorCiteLawKey = process.env.CITELAW_API_KEY;
  const requests = { courtlistener: [], citelaw: [] };
  process.env.COURTLISTENER_API_KEY = 'test-courtlistener-key';
  process.env.CITELAW_API_KEY = 'test-citelaw-key';
  clearCiteLawVerificationCache();
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith('https://www.courtlistener.com/')) {
      requests.courtlistener.push({ url, init });
      return jsonResponse({ results: courtListenerResults });
    }
    if (url === 'https://citelaw.org/api/v1/citations/verify') {
      requests.citelaw.push({ url, init });
      return jsonResponse(
        {
          results: citeLawResults,
          summary: {},
          billing:
            billing ?? {
              citations_verified: citeLawResults.length,
              credits_per_citation_rate: '1 credit / 10 citations',
              credits_charged: citeLawResults.length > 0 ? 1 : 0,
              credits_remaining: 149,
            },
        },
        citeLawStatus,
      );
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  try {
    await fn(requests);
  } finally {
    globalThis.fetch = priorFetch;
    clearCiteLawVerificationCache();
    if (priorCourtListenerKey === undefined) delete process.env.COURTLISTENER_API_KEY;
    else process.env.COURTLISTENER_API_KEY = priorCourtListenerKey;
    if (priorCiteLawKey === undefined) delete process.env.CITELAW_API_KEY;
    else process.env.CITELAW_API_KEY = priorCiteLawKey;
  }
}

await test('parseCaseCitationIdentity extracts only public title, year, and reporter', () => {
  assert.deepEqual(
    parseCaseCitationIdentity(
      'See Navellier v. Sletten (2002) 29 Cal.4th 82 for the anti-SLAPP rule.',
    ),
    {
      citation: '29 Cal.4th 82',
      title: 'Navellier v. Sletten',
      year: 2002,
    },
  );
  assert.deepEqual(parseCaseCitationIdentity('29 Cal.4th 82'), {
    citation: '29 Cal.4th 82',
    title: undefined,
    year: undefined,
  });
  assert.deepEqual(
    parseCaseCitationIdentity(
      'Client Jane Doe relies on Navellier v. Sletten (2002) 29 Cal.4th 82',
    ),
    {
      citation: '29 Cal.4th 82',
      title: 'Navellier v. Sletten',
      year: 2002,
    },
  );
  assert.deepEqual(
    parseCaseCitationIdentity(
      'Wilson v. Cable News Network, Inc. (2019) 7 Cal.5th 871',
    ),
    {
      citation: '7 Cal.5th 871',
      title: 'Wilson v. Cable News Network, Inc.',
      year: 2019,
    },
  );
  assert.deepEqual(
    extractCitations(
      'The court followed Wilson v. Cable News Network, Inc. (2019) 7 Cal.5th 871.',
    ),
    [
      {
        text: 'Wilson v. Cable News Network, Inc. (2019) 7 Cal.5th 871',
        type: 'case',
      },
    ],
  );
});

await test('CiteLaw confirmed supplies positive evidence and billing visibility', async () => {
  await withProviders(
    {
      courtListenerResults: [],
      citeLawResults: [
        {
          status: 'confirmed',
          detected_source: 'cases',
          reason: 'citation, title, and year matched',
          match: {
            id: 'navellier',
            title: 'Navellier v. Sletten',
            citation: ['29 Cal.4th 82'],
            court: 'Cal.',
            year: 2002,
            url: 'https://citelaw.org/authority/cases/navellier',
          },
        },
      ],
    },
    async (requests) => {
      const result = await citationVerify({
        citations: ['Navellier v. Sletten (2002) 29 Cal.4th 82'],
      });
      assert.equal(result.verified, 1);
      assert.equal(result.citations[0].status, 'verified');
      assert.equal(result.citations[0].courtlistener_status, 'not_found');
      assert.equal(result.citations[0].verification_source, 'citelaw');
      assert.equal(result.citations[0].citelaw?.status, 'confirmed');
      assert.equal(result.citelaw.billing?.credits_charged, 1);
      assert.equal(requests.citelaw.length, 1);
      const payload = JSON.parse(String(requests.citelaw[0].init.body));
      assert.deepEqual(payload.citations, [
        {
          citation: '29 Cal.4th 82',
          title: 'Navellier v. Sletten',
          year: 2002,
          category: 'case',
        },
      ]);
      assert.ok(!String(requests.citelaw[0].init.body).includes('anti-SLAPP'));
    },
  );
});

await test('CiteLaw possible_match downgrades a CourtListener exact hit', async () => {
  await withProviders(
    {
      courtListenerResults: [courtListenerHit('Navellier v. Sletten', '29 Cal.4th 82')],
      citeLawResults: [
        {
          status: 'possible_match',
          reason: 'title matched but reporter cite differed',
          candidates: [{ title: 'Navellier v. Sletten', citation: ['29 Cal.4th 83'] }],
        },
      ],
    },
    async () => {
      const result = await citationVerify({
        citations: ['Navellier v. Sletten (2002) 29 Cal.4th 82'],
      });
      assert.equal(result.citations[0].courtlistener_status, 'verified');
      assert.equal(result.citations[0].citelaw?.status, 'possible_match');
      assert.equal(result.citations[0].status, 'unconfirmed');
      assert.equal(result.citations[0].verification_source, undefined);
    },
  );
});

await test('CiteLaw no_match blocks a green badge when CourtListener verified only the reporter slot', async () => {
  await withProviders(
    {
      courtListenerResults: [courtListenerHit('People v. Steskal', '11 Cal.5th 332')],
      citeLawResults: [
        {
          status: 'no_match',
          reason:
            '11 Cal.5th 332 resolves to People v. Steskal, not Bell v. Bayside Restaurant Group.',
        },
      ],
    },
    async () => {
      const result = await citationVerify({
        citations: ['Bell v. Bayside Restaurant Group (2017) 11 Cal.5th 332'],
      });
      assert.equal(result.citations[0].courtlistener_status, 'verified');
      assert.equal(result.citations[0].citelaw?.status, 'no_match');
      assert.equal(result.citations[0].status, 'unconfirmed');
      assert.equal(result.verified, 0);
      assert.equal(result.unconfirmed, 1);
    },
  );
});

await test('dual provider miss preserves not_found without overclaiming CiteLaw certainty', async () => {
  await withProviders(
    {
      courtListenerResults: [],
      citeLawResults: [{ status: 'no_match', reason: 'No authority found.' }],
    },
    async () => {
      const result = await citationVerify({
        citations: ['Imaginary v. Fictional (2020) 99 Cal.5th 999'],
      });
      assert.equal(result.citations[0].courtlistener_status, 'not_found');
      assert.equal(result.citations[0].citelaw?.status, 'no_match');
      assert.equal(result.citations[0].status, 'not_found');
    },
  );
});

await test('CiteLaw provider failure falls back to CourtListener and remains visible', async () => {
  await withProviders(
    {
      courtListenerResults: [courtListenerHit('Navellier v. Sletten', '29 Cal.4th 82')],
      citeLawResults: [],
      citeLawStatus: 401,
    },
    async () => {
      const result = await citationVerify({
        citations: ['Navellier v. Sletten (2002) 29 Cal.4th 82'],
      });
      assert.equal(result.citations[0].status, 'verified');
      assert.equal(result.citations[0].verification_source, 'courtlistener');
      assert.equal(result.citations[0].citelaw?.status, 'unavailable');
      assert.equal(result.citelaw.status, 'unavailable');
      assert.match(result.citelaw.error ?? '', /http 401/u);
    },
  );
});

await test('batched prefetch prevents one-credit-per-sub-agent CiteLaw calls', async () => {
  await withProviders(
    {
      courtListenerResults: [courtListenerHit('Navellier v. Sletten', '29 Cal.4th 82')],
      citeLawResults: [
        {
          status: 'confirmed',
          match: {
            title: 'Navellier v. Sletten',
            citation: ['29 Cal.4th 82'],
            year: 2002,
          },
        },
        {
          status: 'no_match',
          reason: 'Different case occupies the reporter slot.',
        },
      ],
      billing: {
        citations_verified: 2,
        credits_charged: 1,
        credits_remaining: 149,
      },
    },
    async (requests) => {
      const citations = [
        'Navellier v. Sletten (2002) 29 Cal.4th 82',
        'Bell v. Bayside Restaurant Group (2017) 11 Cal.5th 332',
      ];
      const prefetch = await prefetchCiteLawVerification(citations);
      assert.equal(prefetch.submitted, 2);
      assert.equal(prefetch.billing?.credits_charged, 1);

      const result = await citationVerify({ citations: [citations[0]] });
      assert.equal(result.citelaw.status, 'cached');
      assert.equal(result.citelaw.cache_hits, 1);
      assert.equal(result.citelaw.billing?.credits_charged, 0);
      assert.equal(requests.citelaw.length, 1);
    },
  );
});

console.log(`\nCitation verification: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log(JSON.stringify(failures, null, 2));
  process.exit(1);
}
