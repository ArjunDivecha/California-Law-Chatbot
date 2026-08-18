# Handoff: DancingElephant Rebrand (AskPauli → DancingElephant)

## Overview
Full visual rebrand of the California-Law-Chatbot V2 front end (repo: `ArjunDivecha/California-Law-Chatbot`, branch `main`). Same product, same flows, entirely new identity: pink + Georgia serif + emoji chrome is replaced with a violet/teal/amber palette sampled from the new line-elephant logo, Inter + Fraunces typography, and a Lucide line-icon set. No new features — this is a reskin plus microcopy rewrite of existing surfaces.

## About the Design Files
`DancingElephant Redesign.dc.html` is a **design reference created in HTML** — a canvas of static artboards showing intended look and copy, not production code. The task is to **recreate these designs inside the existing React + Tailwind codebase** (`components/v2/*`, `components/*.tsx`), keeping all existing logic, hooks, and API calls intact. Open the HTML file in a browser to see all boards; each artboard is labeled 01–09.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and copy are final. Recreate pixel-perfectly, translating inline styles into the codebase's Tailwind conventions (extend `tailwind.config` with the tokens below rather than hardcoding hex everywhere).

## Screen → repo file map
| Artboard | Implements in |
|---|---|
| 01 Sign-in | `components/SignInPage.tsx` (style Clerk `<SignIn>` via appearance prop to match the card) |
| 02 Welcome / empty chat | `components/v2/V2ChatPage.tsx` (empty state) + `components/v2/V2Sidebar.tsx` |
| 03 Chat | `components/v2/V2ChatPage.tsx`, `V2Sidebar.tsx`, `MatterModeSelector.tsx`, `V2SanitizationChip.tsx` |
| 04 Consent modal | `components/ConfidentialityAttestation.tsx` |
| 05 Verify Citations | `components/v2/V2VerifyPage.tsx` |
| 06 Draft a Document | `components/v2/V2DraftPage.tsx` |
| 07 Drafting Magic | `components/v2/V2DraftingMagicPage.tsx` |
| 08a/08b Mobile | responsive variants of chat + verify (~390px) |
| 09 Component sheet | shared primitives — build these first |

## Design tokens
Colors:
- `brand` (violet primary): `#7C5CFC`; hover/darker `#6847E8`; tint bg `#F3F0FE`; tint border `#E2DAFB`
- `ink` (text): `#2A2233`; secondary `#4A4258`; muted `#6E6580`; faint `#9C94A8`
- `teal` (verified/success): `#2DD4BF` accent, `#14B8A6` icon, text `#0E7C6E` / `#0E5C52`, bg `#E9FBF7` / `#F4FDFB`, border `#BFEEE4`
- `amber` (caution/privileged): accent `#E8A05C`, icon `#D97706`, text `#9A6420`, bg `#FDF6EC` / `#FDFAF4`, PII highlight `#FBEBD3`, border `#F2DCBC`
- `red` (error/contradicted): icon `#B3261E`, text `#8C1D18`, bg `#FDEDEC` / `#FEF7F6`, border `#F4C7C3`
- Surfaces: app bg `#FCFBF9`, cards `#FFFFFF`, hairline borders `#EAE6F0` / `#EEEAF3` / `#E3DEED`
- Dark plum (sign-in panel + logo lockup ONLY, never app canvas): `#221A30`, light text `#F5F2FA`, muted `#B4A9C6`
- Signature gradient: `linear-gradient(90deg, #7C5CFC, #2DD4BF, #E8A05C)`

Typography:
- UI: Inter 400/500/600/700. Body 13.5–14.5px, labels 11–12.5px, section-label uppercase 10.5–12px w/ letter-spacing .05em
- Display: Fraunces (~560 weight) for wordmark, greetings, modal titles (22–34px)
- Rendered legal documents only: Georgia / Times New Roman serif, 13.5px, line-height 1.9. Georgia is removed everywhere else (currently on V2Sidebar, V2VerifyPage, SignInPage — strip those `fontFamily` styles)
- Monospace (citations, tokens, diffs): `ui-monospace`, 11–12.5px

Spacing / shape:
- Card radius 12px; small controls 8–10px; chips pill (99px); modal 16px
- Hairline 1px borders; shadows very subtle: `0 1px 3px rgba(42,34,51,.06)`
- Sidebar 280px; chat column 760px; buttons ~10px vert padding

## Signature motifs
1. **Gradient line** (the logo's continuous line): 2px gradient rule used as (a) top-of-chat accent bar, (b) section divider (static, opacity .6 ok), (c) "thinking" animation — `background-size: 300% 100%` + keyframe animating `background-position` 0% → −300%, 1.6s linear infinite. Also connects steps in the Drafting Magic progress rail (vertical, teal→violet by completion).
2. **Spinner**: 11px circle, 1.5px border `#D7CDF9` with `#7C5CFC` top, .8s rotation.
3. **Logo**: `assets/logo.png` (has dark background baked in) — always shown as a rounded tile (radius ≈ 28% of size). Sizes used: 18/22/26/30/32/44/72/300px.

## Interactions & behavior (unchanged logic, new presentation)
- **Matter-mode selector** (`MatterModeSelector.tsx`): replace the two `<select>`s with a 3-option segmented control — Public research (teal when active), Client confidential (violet), Protected discovery (dark amber `#B97F35` + lock icon). Keep the 409/attorney-override confirm flow and consent recording; consent status becomes a pill chip (teal recorded / amber not obtained / red prohibited) next to the selector.
- **Privacy shield** (`V2SanitizationChip.tsx`): amber pill "N items protected on this device" with shield icon + chevron; expands to token rows `TOKEN ← original` with an ✕ that calls the existing `addToUserAllowlist`. Empty state = teal pill "Nothing to protect in this message" (no globe emoji). Computing state = spinner + "Checking for privileged content…". Additionally highlight detected spans **inline in the composer** (bg `#FBEBD3`, 1.5px bottom border `#E8A05C`, radius 3px) — an overlay div mirroring the textarea is the usual technique.
- **Tool-activity pills**: neutral pill (`#F6F4FB` bg) with spinner while running → teal check + elapsed ms when done → red variant "failed, retrying".
- **Citation verdict rows** (`V2VerifyPage.tsx`): full-width tinted rows (green/red/amber per verdicts real/fake/ambiguous), 17px icon, STATUTE/CASE tag chip, mono citation, bold verdict word, reasoning line below, CourtListener link uses brand violet. Summary = count chips + elapsed, under a static gradient rule. Replace ⟳/✓/✗/⚠️/🌐 glyphs with Lucide icons (`check`, `x`, `alert-circle`, `loader`).
- **Proposed-edit cards** (`V2DraftPage.tsx`): pending card gets violet-tinted border, red strikethrough / green replacement diff blocks, primary "Approve change" + secondary "Skip"; collapsed state rows for Applied (teal) / Skipped (neutral, with Undo) / Couldn't locate (amber).
- **Consent modal** (`ConfidentialityAttestation.tsx`): keep soft-gate logic; new layout = gradient rule top, Fraunces title "Before you continue", 4 icon+text points (device / sent / obligations / no recovery), checkbox row, "Not now" + violet "I understand — continue".
- Buttons: primary violet (hover shifts toward gradient), secondary white w/ `#DDD8E5` border, destructive white w/ red border, disabled `#EDEBF2`/`#9C94A8`.
- Hover on cards/nav: border → `#C9BFF5` or bg `#F6F4FB`; transitions ~150ms ease.

## Copy voice (apply throughout)
Mainstream-professional, verbs on buttons. Key strings: "Protected on this device", "Verify citations", "Approve change", "DancingElephant declined this request and explained why", trust line "Your clients' information is protected on your device before anything is sent.", tagline "Legal AI that never forgets to check."

## Do not
- No pink anywhere (removes all `pink-*` Tailwind classes — currently in V2Sidebar, V2VerifyPage, V2ChatPage, SignInPage, V2SanitizationChip)
- No emoji in chrome (🔒 ⟳ 🌐 ⚠️ ✓ ✗ → Lucide icons, 1.5px stroke)
- No dark-mode app screens; dark plum `#221A30` is sign-in/marketing only
- No "AskPauli", "Pauli", or firm attribution ("femme & femme LLP" link on SignInPage) — remove
- No mascot illustrations; the logo PNG is the only elephant

## Assets
- `assets/logo.png` — DancingElephant logo (provided by client). Also generate favicons from it (replaces `/Heart Favicon.png`).
- Fonts: Google Fonts — Inter (400–700), Fraunces (opsz axis, ~480–640 weight).
- Icons: lucide-react (already a dependency — `ShieldCheck` is imported in ConfidentialityAttestation.tsx).

## Files
- `DancingElephant Redesign.dc.html` — all 9 artboards (open in a browser; artboards labeled 01–09)
- `assets/logo.png`
