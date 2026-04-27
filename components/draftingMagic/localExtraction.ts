export type DraftingMagicSourceRole = 'Trust' | 'Pour-over will' | 'Advance directive' | 'Financial POA' | 'Prenup';

export interface DraftingMagicSourceForExtraction {
  id: string;
  name: string;
  role: DraftingMagicSourceRole;
  description: string;
  included: boolean;
  excerpt?: string;
}

export interface ExtractedDraftingUnit {
  id: string;
  label: string;
  type: string;
  snippet: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface ExtractedComparisonRow {
  id: string;
  issue: string;
  rowType: string;
  sourceALabel: string;
  sourceA: string;
  sourceBLabel: string;
  sourceB: string;
  sourceCLabel: string;
  sourceC: string;
  newLawImpact: string;
  recommendation: 'Keep' | 'Revise' | 'Discard' | 'Add' | 'Review';
  rationale: string;
  confidence: 'High' | 'Medium' | 'Low';
  approved: boolean;
}

const sampleSourceTextById: Record<string, string> = {
  'revocable-trust':
    'Article One. The Chen Family Revocable Trust names Maya Chen as first successor trustee and Daniel Chen as backup successor trustee. Article Two. The trustee may pay health, support, maintenance, and education expenses after incapacity. Article Three. Schedule A funds community and separate assets into the trust without a property-character legend. Article Four. Incapacity requires certification by two licensed physicians or a court determination.',
  'pour-over-will':
    'Article One. The pour-over will sends all residue to The Chen Family Revocable Trust dated March 4, 2021, including later amendments. Article Two. The executor may transfer property to the trustee after death. Article Three. The will does not restate separate-property funding limitations.',
  ahcd:
    'Section One. The advance health care directive names Maya Chen as first health care agent and Daniel Chen as alternate agent. Section Two. The agent may make treatment, placement, and end-of-life decisions when the principal cannot make health care decisions. Section Three. The privacy release uses older HIPAA wording and should be modernized.',
  'financial-poa':
    'Section One. The durable financial power of attorney names Daniel Chen as first financial agent and Maya Chen as alternate agent. Section Two. The power of attorney is effective immediately. Section Three. The agent may handle insurance, benefits, tax, banking, and gifting matters, subject to fiduciary duties.',
  prenup:
    'Article One. The prenuptial agreement preserves each spouse\'s premarital property, listed accounts, appreciation, and disclosure exhibits as separate property unless expressly transmuted. Article Two. Spousal waivers apply only within the agreement scope. Article Three. Gifts and transfers should not expand negotiated waiver boundaries without express consent.',
};

const issuePatterns = [
  {
    label: 'Fiduciary and agent appointments',
    type: 'Decision-maker',
    terms: ['trustee', 'successor', 'agent', 'alternate', 'executor', 'fiduciary'],
  },
  {
    label: 'Property characterization',
    type: 'Property',
    terms: ['separate property', 'community', 'classification', 'transmuted', 'schedule', 'premarital', 'funding'],
  },
  {
    label: 'Pour-over and trust identity',
    type: 'Cross-document link',
    terms: ['pour-over', 'residue', 'residuary', 'trust dated', 'later amendments', 'restatement'],
  },
  {
    label: 'Health care authority and privacy',
    type: 'Authority',
    terms: ['health care', 'treatment', 'end-of-life', 'privacy', 'hipaa', 'placement', 'medical'],
  },
  {
    label: 'Incapacity trigger',
    type: 'Trigger',
    terms: ['incapacity', 'physician', 'court', 'effective immediately', 'cannot make', 'certification'],
  },
  {
    label: 'Spousal waivers and gifting limits',
    type: 'Prenup boundary',
    terms: ['waiver', 'spousal', 'gift', 'gifting', 'transfer', 'consent', 'disclosure exhibits'],
  },
];

export const getSourceText = (source: DraftingMagicSourceForExtraction) =>
  source.excerpt?.trim() || sampleSourceTextById[source.id] || source.description;

const sentenceSplit = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=(?:Article|Section|\d+\.|[A-Z]))/)
    .map((part) => part.trim())
    .filter(Boolean);

const includesAnyTerm = (text: string, terms: string[]) => {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
};

const snippetFor = (source: DraftingMagicSourceForExtraction | undefined, terms: string[], fallback: string) => {
  if (!source || !source.included) {
    return 'Not included in the current packet.';
  }

  const sentences = sentenceSplit(getSourceText(source));
  const matches = sentences.filter((sentence) => includesAnyTerm(sentence, terms));
  const selected = (matches.length ? matches : sentences).slice(0, 2).join(' ');

  return selected || fallback;
};

const confidenceFor = (...snippets: string[]): 'High' | 'Medium' | 'Low' => {
  const present = snippets.filter((snippet) => !snippet.startsWith('Not included') && !snippet.startsWith('No matching')).length;
  if (present >= 3) return 'High';
  if (present >= 2) return 'Medium';
  return 'Low';
};

export const extractDraftingUnits = (source: DraftingMagicSourceForExtraction): ExtractedDraftingUnit[] => {
  const text = getSourceText(source);
  const sentences = sentenceSplit(text);

  const units = issuePatterns
    .map((pattern) => {
      const matches = sentences.filter((sentence) => includesAnyTerm(sentence, pattern.terms));
      if (!matches.length) {
        return null;
      }

      return {
        id: `${source.id}-${pattern.type.toLowerCase().replace(/\s+/g, '-')}`,
        label: pattern.label,
        type: pattern.type,
        snippet: matches.slice(0, 2).join(' '),
        confidence: matches.length > 1 ? 'High' : 'Medium',
      } satisfies ExtractedDraftingUnit;
    })
    .filter((unit): unit is ExtractedDraftingUnit => Boolean(unit));

  if (units.length) {
    return units;
  }

  return [
    {
      id: `${source.id}-general`,
      label: 'General source text',
      type: 'General',
      snippet: sentences.slice(0, 2).join(' ') || source.description,
      confidence: 'Low',
    },
  ];
};

export const buildPacketComparisonRows = (
  sources: DraftingMagicSourceForExtraction[],
  attorneyUpdate: string
): ExtractedComparisonRow[] => {
  const byRole = new Map(sources.map((source) => [source.role, source]));
  const trust = byRole.get('Trust');
  const will = byRole.get('Pour-over will');
  const ahcd = byRole.get('Advance directive');
  const poa = byRole.get('Financial POA');
  const prenup = byRole.get('Prenup');
  const updateLower = attorneyUpdate.toLowerCase();

  const updateImpact = (fallback: string, terms: string[]) =>
    includesAnyTerm(updateLower, terms) ? `Attorney instruction directly calls for this review. ${fallback}` : fallback;

  const fiduciaryTrust = snippetFor(trust, ['trustee', 'successor', 'fiduciary'], 'No trustee language detected.');
  const fiduciaryPoaAhcd = [
    snippetFor(poa, ['agent', 'financial', 'effective immediately'], 'No financial-agent language detected.'),
    snippetFor(ahcd, ['health care agent', 'agent', 'treatment'], 'No health-care-agent language detected.'),
  ].join(' ');
  const fiduciaryPrenup = snippetFor(prenup, ['separate property', 'transfer', 'funding'], 'Prenup does not appoint fiduciaries.');

  const propertyTrust = snippetFor(trust, ['funding', 'schedule', 'separate', 'community'], 'No trust funding language detected.');
  const propertyPrenup = snippetFor(prenup, ['separate property', 'premarital', 'transmuted', 'classification'], 'No prenup property-character language detected.');
  const propertyWill = snippetFor(will, ['residue', 'trust', 'separate', 'property'], 'No pour-over property language detected.');

  const willIdentity = snippetFor(will, ['trust dated', 'residue', 'later amendments', 'pour-over'], 'No pour-over trust identity language detected.');
  const trustIdentity = snippetFor(trust, ['trust', 'restatement', 'dated', 'amendment'], 'No trust identity language detected.');
  const prenupTransfer = snippetFor(prenup, ['transfer', 'separate property', 'community'], 'No prenup transfer constraint detected.');

  const ahcdAuthority = snippetFor(ahcd, ['health care', 'treatment', 'privacy', 'hipaa', 'end-of-life'], 'No AHCD authority language detected.');
  const poaAuthority = snippetFor(poa, ['insurance', 'benefits', 'medical', 'health', 'agent'], 'No financial POA authority language detected.');
  const trustHealth = snippetFor(trust, ['health', 'support', 'maintenance', 'incapacity'], 'No trustee health-expense language detected.');

  const trustIncapacity = snippetFor(trust, ['incapacity', 'physician', 'court'], 'No trust incapacity language detected.');
  const poaIncapacity = snippetFor(poa, ['effective immediately', 'physician', 'certification'], 'No POA trigger language detected.');
  const ahcdIncapacity = snippetFor(ahcd, ['cannot make', 'health care decisions', 'incapacity'], 'No AHCD trigger language detected.');

  const waiverPrenup = snippetFor(prenup, ['waiver', 'spousal', 'gift', 'transfer', 'consent'], 'No prenup waiver language detected.');
  const waiverTrustWill = [propertyTrust, propertyWill].join(' ');
  const waiverPoa = snippetFor(poa, ['gift', 'gifting', 'transfer', 'fiduciary'], 'No POA gifting language detected.');

  return [
    {
      id: 'fiduciary-alignment',
      issue: 'Successor fiduciary alignment',
      rowType: 'Decision-maker conflict',
      sourceALabel: 'Trust',
      sourceA: fiduciaryTrust,
      sourceBLabel: 'Financial POA / AHCD',
      sourceB: fiduciaryPoaAhcd,
      sourceCLabel: 'Prenup',
      sourceC: fiduciaryPrenup,
      newLawImpact: updateImpact(
        'Confirm whether trustee, financial agent, and health care agent order should intentionally diverge.',
        ['agent', 'order', 'fiduciary', 'trustee']
      ),
      recommendation: 'Revise',
      rationale: 'Use the packet appointments, but require the attorney to approve any difference between trustee, financial agent, and health care agent authority.',
      confidence: confidenceFor(fiduciaryTrust, fiduciaryPoaAhcd, fiduciaryPrenup),
      approved: false,
    },
    {
      id: 'property-characterization',
      issue: 'Separate property funding guardrails',
      rowType: 'Property characterization',
      sourceALabel: 'Trust',
      sourceA: propertyTrust,
      sourceBLabel: 'Prenup',
      sourceB: propertyPrenup,
      sourceCLabel: 'Pour-over will',
      sourceC: propertyWill,
      newLawImpact: updateImpact(
        'Funding and distribution language should preserve separate-property treatment created by the prenup.',
        ['prenup', 'separate', 'community', 'property', 'classification']
      ),
      recommendation: 'Revise',
      rationale: 'The trust can remain the base, but funding language should carry a property-character legend when the prenup constrains classification.',
      confidence: confidenceFor(propertyTrust, propertyPrenup, propertyWill),
      approved: false,
    },
    {
      id: 'pour-over-alignment',
      issue: 'Pour-over residuary alignment',
      rowType: 'Cross-document consistency',
      sourceALabel: 'Pour-over will',
      sourceA: willIdentity,
      sourceBLabel: 'Trust',
      sourceB: trustIdentity,
      sourceCLabel: 'Prenup',
      sourceC: prenupTransfer,
      newLawImpact: updateImpact(
        'Use one trust identity across the will, trust, signing memo, and funding instructions.',
        ['trust identity', 'pour-over', 'will', 'normalize']
      ),
      recommendation: 'Keep',
      rationale: 'The pour-over structure can usually remain, but the trust name/date and any prenup carveouts should be normalized before export.',
      confidence: confidenceFor(willIdentity, trustIdentity, prenupTransfer),
      approved: true,
    },
    {
      id: 'healthcare-authority',
      issue: 'Health care authority and privacy release',
      rowType: 'Authority gap',
      sourceALabel: 'AHCD',
      sourceA: ahcdAuthority,
      sourceBLabel: 'Financial POA',
      sourceB: poaAuthority,
      sourceCLabel: 'Trust',
      sourceC: trustHealth,
      newLawImpact: updateImpact(
        'Confirm modern privacy authorization and keep health decisions separate from financial administration.',
        ['privacy', 'hipaa', 'health', 'medical']
      ),
      recommendation: 'Add',
      rationale: 'Add a review item so AHCD privacy language, insurance authority, and trustee payment authority work together without merging roles.',
      confidence: confidenceFor(ahcdAuthority, poaAuthority, trustHealth),
      approved: false,
    },
    {
      id: 'incapacity-standard',
      issue: 'Incapacity standard',
      rowType: 'Trigger definition',
      sourceALabel: 'Trust',
      sourceA: trustIncapacity,
      sourceBLabel: 'Financial POA',
      sourceB: poaIncapacity,
      sourceCLabel: 'AHCD',
      sourceC: ahcdIncapacity,
      newLawImpact: updateImpact(
        'Explain why the trust, financial POA, and AHCD can use different activation standards.',
        ['incapacity', 'trigger', 'effective']
      ),
      recommendation: 'Review',
      rationale: 'The triggers do not need to be identical, but the client-facing draft should make the difference intentional and easy to review.',
      confidence: confidenceFor(trustIncapacity, poaIncapacity, ahcdIncapacity),
      approved: false,
    },
    {
      id: 'spousal-waivers',
      issue: 'Spousal waiver boundaries',
      rowType: 'Prenup constraint',
      sourceALabel: 'Prenup',
      sourceA: waiverPrenup,
      sourceBLabel: 'Trust / Will',
      sourceB: waiverTrustWill,
      sourceCLabel: 'Financial POA',
      sourceC: waiverPoa,
      newLawImpact: updateImpact(
        'Estate-planning language should honor, not silently expand, negotiated prenup waivers.',
        ['waiver', 'spousal', 'gift', 'gifting', 'transfer']
      ),
      recommendation: 'Review',
      rationale: 'Attorney should confirm whether gifting powers, trust distributions, and waivers remain inside the negotiated prenup boundaries.',
      confidence: confidenceFor(waiverPrenup, waiverTrustWill, waiverPoa),
      approved: false,
    },
  ];
};
