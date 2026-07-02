# Memo: Morgan v. V2X — What it means for our AI tool (and our budget)

**To:** Rachel, Lyla
**From:** Arjun
**Date:** June 2, 2026
**Re:** *Morgan v. V2X, Inc.*, 2026 WL 864223 (D. Colo.) — implications for the chatbot and protected-discovery matters
**Status:** Engineering/contractual analysis for your review — not legal advice. The legal-defensibility call is yours.

---

## TL;DR

1. **We do not need an expensive enterprise AI subscription.** Morgan requires a *contract* (no training on our inputs, no third-party disclosure, deletion on request, plus retained documentation) — not a price tier. Anthropic's **standard, pay-as-you-go commercial API terms already provide this for every customer**, at a $0 minimum. We're already on that path.
2. **The case is partly good news for us.** It holds that an attorney's (even a *pro se* litigant's) use of AI gets work-product protection — opposing counsel generally can't pry into *how* we used AI, only the *name* of the tool.
3. **The real work is small and cheap:** capture a few documents for the file, tighten how we handle the *storage* side (our vector database and embeddings — not the AI model), and add a "protected-discovery mode" for matters under a protective order.

---

## 1. What Morgan actually requires

A federal magistrate in Colorado amended a protective order to bar putting CONFIDENTIAL discovery material into any AI tool **unless the provider is contractually**:

- **(1)** prohibited from storing or using inputs to train/improve its model;
- **(2)** prohibited from disclosing inputs to any third party except where essential to delivering the service (and any such third party is bound by equally protective terms); and
- **(3)** required to delete the material on request.

The party must **retain written documentation** of those contractual protections.

**The key point everyone gets wrong:** this is *not* a "Zero Data Retention" requirement. It does not say the provider must keep nothing. It says: don't train on it, don't hand it around, delete it when asked, and keep proof. A provider that briefly retains data for abuse-monitoring but never trains on it and deletes on request can satisfy this.

Equally important: the court's concern was **consumer tools** — it explicitly references "standard ChatGPT, Claude, Gemini." Those are the free public apps whose terms *do* allow training on your inputs. Our tool uses the **commercial API**, whose terms are different and stronger.

## 2. The favorable half of the ruling

The court held that a litigant's AI use is protected attorney **work product** under FRCP 26(b)(3) — uploading material to an AI tool does **not** waive that protection, because AI programs are tools, not adversaries. The only thing the court ordered disclosed was the **name** of the AI platform, not the prompts, strategy, or outputs. For us, that means our work-product footing is *stronger* than the plaintiff's in Morgan (we're counsel, not *pro se*), and the discoverable surface is narrow: be ready to name the tool.

## 3. How much weight to give this

*Morgan* is a **federal magistrate's order in the District of Colorado** — persuasive, not binding on California state courts or the Ninth Circuit, and it's a discovery-management order rather than appellate authority. But the direction of travel is unmistakable: courts are starting to condition AI use on exactly these contractual protections. Treating it as the standard now is prudent, not premature.

## 4. What this means for our budget

The earlier working assumption was: *Morgan-style compliance → Zero Data Retention → Anthropic enterprise plan → too expensive for a two-person firm → fall back to a more complex setup.* **That chain was wrong at the first link.**

- Anthropic's standard Commercial Terms contractually prohibit training on our inputs/outputs — for all API customers, no enterprise plan.
- Accepting those terms automatically includes a Data Processing Addendum (DPA) that covers the no-disclosure and deletion-on-request prongs.
- It's pay-as-you-go with **no minimum spend, no seat license, no annual commitment**.
- Our current build already runs on exactly this, so there is **no migration cost** to be Morgan-compliant on the AI model itself.

In short: the affordability problem was a phantom. We need a signed/captured contract, not a price tier.

## 5. Residual risks we must handle honestly (not hide)

I want to be straight about the limits, because a court will be:

- **Deletion is never absolute, and Morgan doesn't require it to be.** Anthropic (like every provider) can retain backup copies briefly and may hold *abuse-flagged* content longer, and any provider can be forced to preserve data by a litigation hold. These are the same "essential to service / required by law" carve-outs the order itself permits. **We should disclose this residual retention to a court rather than claim zero.**
- **The documentation has to actually be in the file.** "Retained written documentation" means we download and date-stamp the Commercial Terms, the DPA, and the retention policy now — not link to them later.
- **The biggest gap is the *storage* side, not the AI.** Our system also sends text to an embeddings service and stores data in a third-party vector database (Upstash). For ordinary research that's fine with a DPA; but for material under a protective order, that database's own terms may not permit confidential data, and it adds a third party to the chain. The fix is cheap (self-host that piece for protected matters) but it's the part we'd otherwise overlook.

## 6. Proposed response

*(Proposed, for your sign-off — not decided.)*

1. **Capture the paperwork (one hour, $0):** download and date-stamp Anthropic's Commercial Terms + DPA + retention policy; do the same for the embeddings provider. File them where they're retrievable per matter.
2. **Add a `protected_discovery` matter mode** for anything under a protective order. In that mode the tool: blocks open web search and any unapproved external tools; routes storage to a firm-controlled database (no third-party vector store); uses local or DPA-covered embeddings; and records a per-matter list of every provider/tool touched.
3. **Generate a "Morgan compliance pack" on demand:** the captured provider terms + the per-matter tool/provider manifest + an audit record + your attorney attestation that you reviewed the output. This is the file we'd hand a court or opposing counsel.
4. **Update our user-facing disclosure** so we all understand the *name* of the AI tool may be discoverable (and that's acceptable).
5. **Until a matter is confirmed under one of these modes, keep confidential discovery out of the tool.** Tokenization/redaction stays as a backstop, not the primary legal basis.

## 7. What I need from you

- **Scope:** Do we expect to use the tool in matters where discovery is designated CONFIDENTIAL under a protective order? If yes, items 1–4 above become near-term; if we only ever use it for our own research/drafting, the lighter version is enough.
- **Risk tolerance:** Are you comfortable with the standard commercial-API + DPA posture (my recommendation) as the basis for protected matters?
- **Sign-off:** Once you confirm scope, I'll capture the documents and build the protected-discovery mode.

---

*This memo summarizes the contractual terms of AI providers as of June 2026 and how our system uses them. It is an engineering and operational analysis to support your decision; it is not a legal opinion, and the providers' terms can change. The compliance judgment — including how to characterize residual data retention to a court — is yours.*
