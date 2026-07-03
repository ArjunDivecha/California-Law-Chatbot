# Memo: Two Small Subscriptions to Improve the Research Assistant's Accuracy

Date: July 3, 2026

To: Rachel, Lyla

From: California Law Chatbot Project Team

Re: Free Law Project membership and CLA membership — what they are, why they're worth it, and cost

We reviewed alternatives for how the chatbot verifies citations, since the CEB material it relies on has been getting stale and the built-in checking wasn't catching everything it should. Two small paid memberships would meaningfully improve accuracy for not much money.

**1. Free Law Project (courtlistener.com) membership — Tier 1, $100/year.** This is the nonprofit that runs CourtListener, the case-law database the chatbot already checks citations against. Right now we're using their free, rate-limited access, which causes some real citations to come back as "unverifiable" simply because we hit a limit — not because anything is wrong. Tier 1 more than doubles our daily and hourly limits and gives access to their proper citation-verification API, so the chatbot can reliably confirm a citation is real instead of shrugging. (Their pricing scales up to $1,000/year for high-volume automated use, but Tier 1 comfortably covers our level of use — we can upgrade later if we ever outgrow it.)

**2. California Lawyers Association (CLA) membership — Introductory tier, $140/year per attorney.** Membership includes free access to Fastcase/vLex's Cert citator — the "is this case still good law" tool (similar to Westlaw's KeyCite or Lexis's Shepard's, which the firm doesn't currently subscribe to). This fills the one gap nothing else in our stack currently covers: confirming a case hasn't been overruled or depublished before it goes in front of a judge. This is a manual lookup tool you'd use directly in your browser when the chatbot flags a citation as unverified — it's not something the chatbot calls automatically. CLA's higher tiers ($180 and $300) add extra practice-section memberships, MCLE credits, and publications, but the Fastcase access we're after is already included at the base Introductory tier, so that's the one to get. Each of you needs your own membership; there may be a discount for joining together, worth checking on their site.

**Total cost:** $100/year (firm-wide) + $140/year per attorney ($280/year for both of you) = **$380/year combined**, well within what we budgeted for this. Both are quick to set up — links and steps are in a separate note if you'd like to go ahead.
