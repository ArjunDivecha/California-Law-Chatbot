#!/usr/bin/env python3
"""
GLiNER-based PII detector — subprocess wrapper for the trap harness.

Usage:
  echo '{"text": "..."}' | gliner_detect.py
  python gliner_detect.py "text on argv"

Output JSON to stdout:
  {"spans": [{"start": 0, "end": 4, "label": "name", "text": "..."}, ...]}

Maps GLiNER's PII labels → V2 SpanCategory taxonomy. Only emits the
categories we care about for tokenization. The model loads once per
process — for batch use, prefer feeding multiple texts through stdin
(one JSON per line) to amortize load cost.

Per V1→V2 audit 2026-05-14 Phase C: GLiNER (urchade/gliner_multi_pii-v1)
is span-based and trained on a different corpus than the AI4Privacy
OPF family, so its failure modes are uncorrelated. Use as a 3rd
detector alongside stock OPF + regex.
"""

import json
import sys
import os

# Suppress transformers progress bars
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

from gliner import GLiNER  # type: ignore

# Load model once at startup (~1-2s warmup).
MODEL = GLiNER.from_pretrained('urchade/gliner_multi_pii-v1')

# Labels GLiNER recognizes — we ask for the ones we care about for PII
# in legal context. Map to V2 SpanCategory values.
LABEL_MAP = {
    'person': 'name',
    'full name': 'name',
    'first name': 'name',
    'last name': 'name',
    'full address': 'street_address',
    'address': 'street_address',
    'phone number': 'phone',
    'email address': 'email',
    'email': 'email',
    'date': 'date',
    'date of birth': 'date',
    'social security number': 'ssn',
    'credit card number': 'credit_card',
    'driver license': 'driver_license',
    'medical condition': 'medical_record',
    'patient id': 'medical_record',
    'zip code': 'zip',
    'postal code': 'zip',
}

# Build the prompt label list (GLiNER expects user-supplied label names)
GLINER_LABELS = list(LABEL_MAP.keys())

# Detection threshold. Tuned 2026-05-15 from 0.4 → 0.7 to suppress
# overreach on common legal/role/geographic terms while keeping true
# names (which typically score >0.9). Override via GLINER_THRESHOLD env.
THRESHOLD = float(os.environ.get('GLINER_THRESHOLD', '0.7'))

# Stoplist — terms GLiNER frequently mis-tags as person/address but
# which carry no client-identifying information. Matched case-
# insensitively against the span's `text`. Maintained here rather than
# in the V2 allowlist because allowlist is for SUBSTRING matches in raw
# input (e.g. "Cal. 4th"); this stoplist is for FULL-SPAN matches
# against a GLiNER prediction.
STOPLIST_LOWER = {
    # Salutations / titles
    'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'hon.', 'sir', 'madam',
    'mr', 'mrs', 'ms', 'dr', 'prof', 'hon',
    # Generic legal roles (not personal names)
    'petitioner', 'respondent', 'plaintiff', 'defendant', 'appellant',
    'appellee', 'client', 'witness', 'co-counsel', 'co-trustee',
    'co-trustees', 'executor', 'executrix', 'trustee', 'trustees',
    'beneficiary', 'beneficiaries', 'grantor', 'settlor', 'guardian',
    'conservator', 'fiduciary', 'attorney', 'counsel', 'lawyer',
    'judge', 'justice', 'magistrate', 'clerk', 'court reporter',
    'witness', 'declarant', 'affiant', 'surviving spouse',
    # Generic professions
    'architect', 'engineer', 'doctor', 'physician', 'nurse', 'teacher',
    'professor', 'student', 'resident', 'partner', 'associate',
    'consultant', 'manager', 'director', 'officer', 'analyst',
    'developer', 'designer', 'accountant', 'auditor', 'pharmacist',
    'therapist', 'counselor', 'researcher', 'pilot', 'driver',
    'mechanic', 'carpenter', 'electrician', 'plumber',
    'boeing engineer', 'cisco engineer',
    # Days/months/time
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    'sunday', 'morning', 'afternoon', 'evening', 'night', 'noon',
    'midnight', '2 pm', '2 am', '2pm', '2am', 'am', 'pm',
    'january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december',
    # Hyphenated ethnic/national adjectives — these describe a community,
    # not a specific person. The compound-risk pass picks up the
    # privacy signal when combined with other attributes.
    'korean-american', 'vietnamese-american', 'iranian-american',
    'mexican-american', 'chinese-american', 'japanese-american',
    'indian-american', 'filipino-american', 'african-american',
    'asian-american', 'mexican american', 'iranian american',
    'korean american', 'vietnamese american', 'chinese american',
    'japanese american', 'indian american', 'filipino american',
    'african american', 'asian american',
    # Bare nationality / ethnic adjectives
    'russian', 'mexican', 'lebanese', 'chinese', 'korean', 'vietnamese',
    'japanese', 'indian', 'filipino', 'african', 'asian', 'european',
    'middle eastern', 'european', 'persian', 'arab', 'hispanic', 'latino',
    'latina', 'latinx',
    # Religious adjectives / clergy
    'orthodox', 'catholic', 'protestant', 'buddhist', 'muslim', 'jewish',
    'hindu', 'sikh', 'mormon', 'evangelical', 'pastor', 'priest', 'rabbi',
    'imam', 'monk', 'nun', 'bishop',
    # More generic occupations
    'restaurateur', 'proprietor', 'owner', 'founder', 'entrepreneur',
    'executive', 'CEO', 'CFO', 'CTO', 'COO', 'president', 'vice president',
    # Common org names — when mentioned generically, not as a client.
    'wells fargo', 'cisco', 'boeing', 'google', 'apple', 'meta',
    'microsoft', 'amazon', 'tesla', 'salesforce', 'oracle', 'intel',
    'nvidia', 'ucsf', 'ucla', 'usc', 'stanford', 'berkeley', 'caltech',
    'kaiser', 'bank of america', 'chase', 'citibank',
    # CA cities/regions used as generic geographic, not addresses
    'los angeles', 'san francisco', 'san diego', 'san jose', 'sacramento',
    'fresno', 'oakland', 'berkeley', 'long beach', 'cupertino',
    'palo alto', 'mountain view', 'sunnyvale', 'pasadena', 'beverly hills',
    'la jolla', 'malibu', 'santa monica', 'santa barbara', 'santa clara',
    'fremont', 'hayward', 'walnut creek', 'orinda', 'lafayette',
    'marin county', 'alameda county', 'orange county', 'santa clara county',
    'silicon valley', 'bay area', 'sf bay area',
    # Schools / institutions commonly mentioned as third-party orgs
    'bishop o\'dowd', "bishop o'dowd",
    # Common legal phrases
    'family trust', 'common trust', 'living trust', 'revocable trust',
    'irrevocable trust', 'special needs trust', 'pot trust',
    # Relationship words
    'twins', 'triplets', 'siblings',
}


# Common prefix tokens GLiNER frequently glues onto person spans.
# When detected, we trim them off the start of the span so the resulting
# token is just the name (and the prefix word stays unredacted).
PREFIX_TRIM = [
    'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Hon.', 'Honorable',
    'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Hon',
    'Witness', 'Petitioner', 'Respondent', 'Plaintiff', 'Defendant',
    'Appellant', 'Appellee', 'Co-counsel', 'Co-trustee', 'Counsel',
    'Attorney', 'Client', 'client', 'Trustee', 'Beneficiary',
    'Executor', 'Settlor', 'Grantor', 'Guardian',
]


def trim_prefix(text: str, start: int) -> tuple[str, int]:
    """If `text` starts with a common prefix word followed by whitespace,
    return (stripped_text, new_start) advancing past the prefix."""
    for p in PREFIX_TRIM:
        if text.startswith(p + ' '):
            new_text = text[len(p) + 1:]
            new_start = start + len(p) + 1
            return new_text, new_start
    return text, start


def detect(text: str) -> dict:
    if not text:
        return {'spans': []}
    raw = MODEL.predict_entities(text, GLINER_LABELS, threshold=THRESHOLD)
    out = []
    for r in raw:
        cat = LABEL_MAP.get(r['label'].lower())
        if not cat:
            continue
        span_text = r['text']
        span_start = r['start']
        # Trim leading title/role prefix that GLiNER often glues on.
        if cat == 'name':
            span_text, span_start = trim_prefix(span_text, span_start)
        # Stoplist filter — case-insensitive full-span match.
        if span_text.strip().lower() in STOPLIST_LOWER:
            continue
        # Drop empty spans created by aggressive prefix trim.
        if not span_text.strip():
            continue
        out.append({
            'start': span_start,
            'end': r['end'],
            'label': r['label'],
            'category': cat,
            'text': span_text,
            'score': r.get('score'),
        })
    return {'spans': out}


def main():
    if len(sys.argv) > 1:
        # text on argv
        text = sys.argv[1]
        print(json.dumps(detect(text), ensure_ascii=False))
        return

    # batch mode: read one JSON per line from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            text = obj.get('text', '')
            print(json.dumps(detect(text), ensure_ascii=False), flush=True)
        except Exception as e:
            print(json.dumps({'error': str(e)}), flush=True)


if __name__ == '__main__':
    main()
