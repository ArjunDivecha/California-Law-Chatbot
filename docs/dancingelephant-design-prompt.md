# DancingElephant — Claude Design Prompt

**What this file is:** A ready-to-paste prompt for Claude Design (claude.ai design feature /
`/design` canvas) to generate the full UI redesign for the AskPauli → DancingElephant rebrand.
Written 2026-08-17 from a code-level audit of the current V2 front end.

**Inputs:** Current UI audited from `components/v2/*`, `App.tsx`, `landing/index.html`;
new logo at `/Users/arjundivecha/Dropbox/AAA Backup/A Working/California-Law-Chatbot/docs/DancingElephant Logo.png`
(attach this image alongside the prompt — Claude Design should sample the gradient from it).

**Output:** None (this document is the deliverable; paste the prompt below into Claude Design).

---

## How to use

1. Open Claude Design and attach the logo PNG.
2. Paste the entire prompt below the divider.
3. Generate; iterate on individual artboards rather than regenerating the whole canvas.

---

## THE PROMPT (copy everything below this line)

Design a complete modern UI system for **DancingElephant** — an AI legal research and
drafting assistant for California solo and small-firm attorneys. This is a rebrand of an
existing production app: same product, entirely new visual identity. The attached logo is
the anchor: a minimal elephant drawn in one continuous line, with a gradient flowing
purple → violet → teal → warm amber.

### Brand positioning

- **Audience:** licensed attorneys at solo and small firms. Professional buyers who need to
  trust this tool with privileged client material.
- **Personality:** friendly but serious. Modern legal-tech, mainstream and broadly
  appealing — think Linear/Notion/Stripe-level polish applied to a legal product. Warm and
  approachable, never cute or whimsical despite the playful name. No niche or
  identity-specific styling; no rainbow treatments.
- **The name's meaning:** an elephant never forgets and never fabricates — memory,
  reliability, verified citations. "Dancing" = the surprising lightness and speed. Let that
  duality (heavy trustworthiness + light agility) drive the design: solid, calm layouts with
  moments of fluid gradient motion.

### Visual language

- **Light mode only. Hard requirement.** Backgrounds are white / warm off-white
  (`#FCFBF9`-ish). The logo's dark-plum background is for the logo lockup and marketing
  hero moments only, never the app canvas.
- **Palette:** sample the logo gradient. Primary accent: the violet-purple (~`#7C5CFC`).
  Secondary: teal (~`#2DD4BF`) for verified/success states. Warm amber (~`#E8A05C`) for
  caution/privileged-content states. Deep plum-ink (~`#2A2233`) for text instead of pure
  black. Semantic colors: green = verified, amber = needs review, red = contradicted/fake.
  Use the full gradient sparingly — logo, primary CTA hover, hero moments, loading/streaming
  shimmer — not as a wash over everything.
- **Typography:** replace the current Georgia serif body with a modern pairing — a
  contemporary humanist sans for UI (Inter or similar) and a distinctive serif or
  semi-serif display face for headings and document surfaces (Fraunces works well),
  preserving an "editorial legal" flavor where documents are shown. Generated legal
  documents themselves still render in a traditional serif.
- **The line motif:** the logo's single continuous line is the signature. Echo it as thin
  gradient rules, progress indicators, connector lines between workflow steps, and a
  streaming/"thinking" animation (a gradient line drawing itself).
- **Iconography:** one consistent line-icon set (Lucide-style, 1.5px stroke). The current
  app mixes emoji glyphs — eliminate all emoji from chrome.
- **Density:** calm and spacious. Cards with soft radii (10–14px), hairline borders, very
  subtle shadows. Restraint over decoration.

### Artboards to design (desktop, ~1440px wide, plus two mobile frames)

1. **Chat (main surface).** Left sidebar (~280px): logo lockup, "New chat" primary button,
   nav to Draft / Drafting Magic / Verify Citations, recent-session list (title, message
   count, relative time). Main pane: top bar with a **matter-mode selector** (Public
   research / Client confidential / Protected discovery — the protected state shows a lock)
   and a client-consent status chip; message thread with user vs. assistant bubbles
   (assistant messages are rendered markdown with citations); a **sources panel** grouping
   citations by provider with per-source verified ✓ / not-found chips; streaming state
   showing small **tool-activity pills** (spinner → check, with elapsed ms) and a
   "thinking" gradient-line animation. Composer at bottom: a text area with **inline
   amber highlights over detected private information** (names, SSNs, case numbers) and a
   compact "privacy shield" summary chip beneath it ("3 items protected on this device")
   that expands to show tokenized terms. This on-device privacy redaction is the product's
   core trust feature — make it visible, reassuring, and elegant, not alarming.
2. **Welcome / empty chat state.** First-run view of the chat surface: friendly greeting,
   3–4 suggested-prompt cards (research a question, draft a motion, verify citations,
   summarize a document), and a one-line trust statement ("Your clients' information is
   protected on your device before anything is sent."). No origin-story card.
3. **Verify Citations.** Two-pane tool: left = paste box for a brief/memo with the same
   privacy chip and a "Verify citations" CTA; right = results list where each citation gets
   a verdict row — green check "Verified", red x "Contradicted", amber "Verify manually" —
   plus a summary bar (counts, elapsed time). This screen is the brand promise ("an
   elephant never fabricates") — give it weight.
4. **Draft a Document.** Document-review workflow: uploaded document on one side; on the
   other, a stack of discrete **proposed-edit cards**, each showing a small red/green diff
   with Approve / Skip buttons and Applied / Skipped / "Couldn't locate" states. Header
   shows export actions (DOCX, PDF). The attorney approves every change individually —
   the layout must communicate "you are in control."
5. **Drafting Magic (workbench).** Densest screen, three zones: source-documents column
   (uploaded files with status), center packet-builder (choose a document pathway/template,
   then a section-by-section editable draft with per-section regenerate and
   compare/diff), right-side progress rail using the gradient-line motif to connect steps.
   Autosave timestamp in the header.
6. **Sign-in.** Centered auth card (Clerk-style email + Google button) on a marketing-grade
   backdrop: dark-plum panel or split layout where the logo's line elephant animates/draws
   itself, wordmark + tagline. This is the one surface where the dark logo treatment shines.
7. **Consent / attestation modal.** A one-time confidentiality attestation dialog over the
   chat: explains in plain language what stays on-device vs. what is sent, checkbox +
   "I understand" CTA. Serious but not scary.
8. **Mobile:** chat surface and verify-citations results as ~390px frames.

### Component sheet (one artboard)

Buttons (primary gradient-edge, secondary, destructive, disabled), the matter-mode selector
in all three states, consent-status chips, privacy/sanitization chip (collapsed + expanded),
tool-activity pills (running/succeeded/failed), citation verdict rows (all three verdicts),
proposed-edit card (pending/applied/skipped), toast/banner styles (error, model-failover
info, refusal notice), and the gradient thinking-line animation spec.

### Copy voice

Rewrite microcopy mainstream-professional and concise: e.g. "Protected on this device"
instead of jargon; "DancingElephant declined this request and explained why" for refusals;
buttons are verbs ("Verify citations", "Approve change"). Tagline direction to explore:
"Legal AI that never forgets to check." All copy in the designs should read as final, not
lorem ipsum.

### Do not

- No dark-mode app screens. No rainbow/pride gradients (the logo gradient is
  purple-teal-amber, not a rainbow — keep it that way). No cartoon elephants or mascot
  illustrations beyond the line-art logo. No pink as a brand color (that's the old brand).
  No emoji in UI chrome. No "AskPauli", "Pauli", or law-firm attribution anywhere.

---

*End of prompt.*
