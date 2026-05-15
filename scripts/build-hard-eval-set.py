#!/usr/bin/env python3
"""
Build a CA-jurisdiction hard-eval set for Phase A.6.5 (V1→V2 audit
2026-05-14). Distribution matches the F&F California legal practice
mix: heavy Latino/Asian representation, mixed Latin and non-Latin
scripts, realistic legal-context templates.

Output: tests/hard-eval-ca-jurisdiction.jsonl
Each row: {"text": "...", "spans": {"private_person": [[s,e],...],
                                      "private_address": [[s,e],...]}}

Span indices are computed by string search after template fill — the
script asserts each substring is found exactly once per template, so
the spans are unambiguous.
"""

import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = REPO_ROOT / "tests" / "hard-eval-ca-jurisdiction.jsonl"

# ---------------------------------------------------------------------------
# Names organized by ethnic/script category
# ---------------------------------------------------------------------------

NAMES = {
    "latino": [
        "María González",
        "José Rodríguez",
        "Carmen Hernández",
        "Luis Martínez",
        "Sofía Ramírez",
        "Diego Vargas",
        "Esperanza Castillo",
        "Antonio López",
        "Lucía Mendoza",
        "Carlos Reyes",
    ],
    "chinese": [
        "Wei Liu",
        "Xiao Ming Chen",
        "Mei Zhang",
        "Jian Wang",
        "Ying Li",
        "Hua Cheng",
        "Bao Yu",
        "Lin Wong",
        "Feng Tang",
        "Yan Zhou",
    ],
    "vietnamese": [
        "Nguyen Van Anh",
        "Tran Thi Hoa",
        "Pham Minh Tuan",
        "Le Thi Mai",
        "Hoang Van Duc",
        "Vo Thanh Long",
        "Bui Thi Linh",
        "Dang Quoc Bao",
        "Dinh Hoang Phuc",
        "Ly Anh Khoa",
    ],
    "korean": [
        "Min-Jun Kim",
        "Seo-Yun Park",
        "Ji-Ho Lee",
        "Ha-Eun Choi",
        "Sang-Woo Jung",
        "Yu-Na Kang",
        "Hyun-Woo Cho",
        "Eun-Ji Yoon",
        "Tae-Yang Shin",
        "Mi-Sook Han",
    ],
    "filipino": [
        "Maria Santos",
        "Juan Cruz",
        "Rosa Reyes",
        "Antonio Bautista",
        "Liwayway Mendoza",
        "Eduardo Ramos",
        "Imelda Garcia",
        "Joselito Aquino",
        "Lourdes Domingo",
        "Ferdinand Villanueva",
    ],
    "persian": [
        "Arash Hosseini",
        "Yasmin Karimi",
        "Reza Mohammadi",
        "Shirin Tehrani",
        "Babak Sharifi",
    ],
    "south_asian": [
        "Priya Patel",
        "Rajesh Krishnan",
        "Anjali Singh",
        "Vikram Sharma",
        "Meera Reddy",
    ],
    "russian": [
        "Aleksandr Petrov",
        "Natalya Volkova",
        "Dmitri Smirnov",
        "Yelena Mikhailova",
        "Sergei Ivanov",
    ],
    "eastern_european": [
        "Marek Kowalski",
        "Beata Nowak",
        "Stanislav Horváth",
        "Katarína Varga",
        "Tibor Kovács",
    ],
    "hebrew": [
        "Yael Goldberg",
        "Eitan Mizrahi",
        "Tamar Cohen",
        "Avi Shapiro",
        "Noa Friedman",
    ],
}

# Hard-case names — single word, hyphenated, abbreviated, mixed-case
HARD_NAMES = [
    ("Liu", "single-word last name"),
    ("Mei-Lin Wong-Chen", "hyphenated"),
    ("J. Hernandez", "abbreviated first name"),
    ("st. claire", "lowercase + period (intentional)"),
    ("Đỗ Văn Hùng", "Vietnamese diacritics"),
    ("李明", "Chinese characters"),
    ("김지영", "Korean characters"),
    ("Луна Иванова", "Cyrillic"),
]

# ---------------------------------------------------------------------------
# California addresses
# ---------------------------------------------------------------------------

ADDRESSES = [
    # SF Bay Area
    "1234 Mission Street, San Francisco, CA 94103",
    "555 Castro Street, Apt 12, Mountain View, CA 94041",
    "2401 University Avenue, Suite 100, Palo Alto, CA 94301",
    "789 Telegraph Avenue, Oakland, CA 94612",
    "4567 Stevens Creek Boulevard, Santa Clara, CA 95051",
    "12 Sausalito Lateral, Sausalito, CA 94965",
    # LA County
    "1100 Wilshire Boulevard, Los Angeles, CA 90017",
    "8200 Sunset Boulevard, West Hollywood, CA 90069",
    "PO Box 4567, Pasadena, CA 91102",
    "3456 Olympic Boulevard, Suite 200, Beverly Hills, CA 90210",
    "9876 Ventura Blvd, Sherman Oaks, CA 91423",
    # Central Valley + Coast
    "234 H Street, Fresno, CA 93721",
    "12345 Highway 1, Carmel-by-the-Sea, CA 93923",
    "6789 Mooney Boulevard, Visalia, CA 93277",
    # SD County
    "555 W Broadway, Suite 1500, San Diego, CA 92101",
    "1234 La Jolla Boulevard, La Jolla, CA 92037",
    # Non-standard / mixed-script
    "888 大道 Street, San Francisco, CA 94108",  # Chinese district address
    "2468 Calle de la Paz, San Diego, CA 92107",  # Spanish street name
    "1357 Đường Saigon, San Jose, CA 95116",      # Vietnamese street name
    "Apt 4B, 999 Ocean Drive, Santa Monica, CA 90402",
]

# ---------------------------------------------------------------------------
# Legal-context templates
# ---------------------------------------------------------------------------

TEMPLATES = [
    "Please draft a demand letter for my client {name} at {address}.",
    "My client {name} of {address} is filing for divorce in Marin County Superior Court.",
    "Schedule a consultation with {name}, currently residing at {address}, regarding the estate plan amendment.",
    "{name} (residence: {address}) has retained our firm for representation in a probate matter.",
    "Send the settlement documents to {name} at {address}. Confirm receipt within 5 business days.",
    "Please prepare a trust amendment for {name}. Their address of record is {address}.",
    "Conflict check: prospective client {name}, address {address}, opposing party John Doe.",
    "Filing a petition for guardianship on behalf of {name} who lives at {address}.",
    "{name}, a resident of {address}, has retained us for a wrongful termination action.",
    "Memo to file: client {name} ({address}) signed the retainer agreement on Tuesday.",
    # Name-only templates (no address) — tests private_person detection alone
    "I need to draft a demand letter for {name} regarding her landlord dispute.",
    "{name} is the petitioner in the upcoming hearing.",
    "Schedule a deposition for {name} next Thursday at 2pm.",
    "Please review {name}'s declaration before filing.",
    "Conflict check: {name}, opposing party Smith.",
    # Address-only / one-name templates — varied structure
    "Send the response to {address}. The matter is confidential.",
    "Service was attempted at {address} without success.",
    "Mailing address for the trust beneficiary: {address}.",
]


def find_one(text: str, needle: str) -> tuple[int, int]:
    """Return (start, end) of `needle` in `text`. Asserts exactly one match."""
    n = text.count(needle)
    if n != 1:
        raise ValueError(
            f"expected exactly 1 occurrence of {needle!r} in {text!r}, found {n}"
        )
    start = text.find(needle)
    return start, start + len(needle)


def build_examples() -> list[dict]:
    rows = []

    # Pass 1: name + address combos. 8 templates × distribute names.
    name_pool = []
    for ethnicity, names in NAMES.items():
        for n in names:
            name_pool.append((n, ethnicity))

    addr_pool = ADDRESSES * (len(name_pool) // len(ADDRESSES) + 1)

    address_templates = [t for t in TEMPLATES if "{address}" in t and "{name}" in t]
    name_only_templates = [t for t in TEMPLATES if "{name}" in t and "{address}" not in t]
    addr_only_templates = [t for t in TEMPLATES if "{address}" in t and "{name}" not in t]

    template_idx = 0
    for i, (name, ethnicity) in enumerate(name_pool):
        # ~70% get both name+address, ~30% get name-only
        if i % 10 < 7:
            t = address_templates[template_idx % len(address_templates)]
            template_idx += 1
            addr = addr_pool[i % len(addr_pool)]
            text = t.format(name=name, address=addr)
            try:
                name_span = find_one(text, name)
                addr_span = find_one(text, addr)
            except ValueError as e:
                # Skip examples where substring is ambiguous (extremely rare)
                continue
            rows.append({
                "text": text,
                "spans": {
                    "private_person": [list(name_span)],
                    "private_address": [list(addr_span)],
                },
                "_meta": {"ethnicity": ethnicity, "template_id": template_idx},
            })
        else:
            t = name_only_templates[template_idx % len(name_only_templates)]
            template_idx += 1
            text = t.format(name=name)
            try:
                name_span = find_one(text, name)
            except ValueError:
                continue
            rows.append({
                "text": text,
                "spans": {"private_person": [list(name_span)]},
                "_meta": {"ethnicity": ethnicity, "template_id": template_idx},
            })

    # Pass 2: hard-case names embedded in templates.
    for name, kind in HARD_NAMES:
        t = name_only_templates[len(rows) % len(name_only_templates)]
        text = t.format(name=name)
        try:
            name_span = find_one(text, name)
        except ValueError:
            continue
        rows.append({
            "text": text,
            "spans": {"private_person": [list(name_span)]},
            "_meta": {"ethnicity": "hard_case", "kind": kind},
        })

    # Pass 3: address-only templates
    for i, addr in enumerate(ADDRESSES[:8]):
        t = addr_only_templates[i % len(addr_only_templates)]
        text = t.format(address=addr)
        try:
            addr_span = find_one(text, addr)
        except ValueError:
            continue
        rows.append({
            "text": text,
            "spans": {"private_address": [list(addr_span)]},
            "_meta": {"ethnicity": "address_only"},
        })

    return rows


def main():
    rows = build_examples()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Write JSONL. opf eval expects each row to have `text` + `spans`.
    # Strip the _meta field from the on-disk format; keep a sidecar
    # with the metadata for our own analysis.
    written = 0
    with OUT_PATH.open("w") as f:
        for row in rows:
            clean = {"text": row["text"], "spans": row["spans"]}
            f.write(json.dumps(clean, ensure_ascii=False) + "\n")
            written += 1

    meta_path = OUT_PATH.with_suffix(".meta.jsonl")
    with meta_path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    # Distribution summary
    ethnicities = {}
    for r in rows:
        e = r["_meta"].get("ethnicity", "unknown")
        ethnicities[e] = ethnicities.get(e, 0) + 1

    print(f"Wrote {written} examples to {OUT_PATH}")
    print(f"Metadata at {meta_path}")
    print()
    print("Distribution:")
    for e, c in sorted(ethnicities.items(), key=lambda x: -x[1]):
        print(f"  {e}: {c}")


if __name__ == "__main__":
    main()
