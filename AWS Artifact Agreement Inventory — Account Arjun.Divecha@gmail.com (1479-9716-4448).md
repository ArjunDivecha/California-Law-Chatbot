## AWS Artifact Agreement Inventory — Account: Arjun.Divecha@gmail.com (1479-9716-4448)

---

### Account Agreements (6 found)

| Agreement                                       | Type                          | Status                                           | Effective Date     | Notes                                                        |
| ----------------------------------------------- | ----------------------------- | ------------------------------------------------ | ------------------ | ------------------------------------------------------------ |
| AWS Business Associate Addendum (BAA)           | HIPAA / PHI Addendum          | **Accepted / Active**                            | April 22, 2026     | Accepting principal not shown in UI. Covers PHI use with HIPAA Eligible Services on this account only. |
| AWS Australian Notifiable Data Breach Addendum  | Privacy / Regulatory Addendum | Available – Not Accepted (Inactive)              | —                  | Not accepted; applies to processing personal info of Australian individuals. |
| AWS Japan Anti-Social Forces Addendum           | Regulatory Addendum (Japan)   | Available – Not Accepted (Inactive)              | —                  | Relevant only if account is used for Japan-regulated activities. |
| AWS New Zealand Notifiable Data Breach Addendum | Privacy / Regulatory Addendum | Available – Not Accepted (Inactive)              | —                  | Not accepted; applies to processing personal info of NZ individuals. |
| AWS SEC Rule 17a-4 Addendum                     | Financial Regulatory Addendum | Available – Not Accepted (Inactive)              | —                  | Relevant only for broker-dealer record-keeping obligations.  |
| AWS SEC Rule 18a-6 Addendum                     | Financial Regulatory Addendum | Available – Not Accepted (Inactive)              | —                  | Relevant only for security-based swap dealers.               |
| AWS Customer Agreement                          | Master Service Agreement      | **Not in Artifact** (agreed at account creation) | Accepted at signup | AWS Customer Agreement is accepted at account creation, not via Artifact. Cannot be tracked here. |
| CCPA-Specific Addendum                          | Privacy / Regulatory Addendum | **Does not exist as separate agreement**         | —                  | AWS folds CCPA obligations into its DPA within the Customer Agreement/Service Terms — no standalone Artifact entry. |

---

### Organization Agreements

| Agreement | Type | Status                                       | Notes                                                        |
| --------- | ---- | -------------------------------------------- | ------------------------------------------------------------ |
| (None)    | —    | **N/A — Account not in an AWS Organization** | This is a standalone account. No org-level agreements are applicable. |

---

### Reports Section Search Results

| Search Term                | Results   | Available for Download | Notes                                                        |
| -------------------------- | --------- | ---------------------- | ------------------------------------------------------------ |
| "Data Processing Addendum" | 0 matches | No                     | AWS DPA is embedded in the Customer Agreement/Service Terms, not a standalone Artifact report. |
| "GDPR"                     | 1 match   | Yes (not downloaded)   | *CyberVadis Third Party Risk Management Assessment* (Certifications & Attestations, June 16 2025 – current). This covers GDPR as part of a broader risk framework assessment — it is **not** a GDPR DPA or EU SCCs document. |
| "CCPA"                     | 0 matches | No                     | No CCPA-specific report exists in Artifact.                  |

---

### Action Items

- **AWS Customer Agreement status unverifiable via Artifact.** The Customer Agreement is accepted at account creation and does not appear in Artifact. Confirm it is current by reviewing [aws.amazon.com/agreement](https://aws.amazon.com/agreement) and checking whether the account was created under a custom Enterprise Agreement (EA) instead, if applicable for your legal-tech context.

- **AWS BAA is Active — verify HIPAA Eligible Services coverage.** The BAA was accepted on April 22, 2026. If you are processing any Protected Health Information (PHI), confirm that you are only using [HIPAA Eligible Services](https://aws.amazon.com/compliance/hipaa-eligible-services-reference/) and that all PHI is encrypted in-transit and at-rest, as required by the BAA.

- **No GDPR Data Processing Addendum (DPA) or EU Standard Contractual Clauses (SCCs) surfaced in Artifact.** AWS incorporates its DPA (including EU SCCs for EEA/UK data transfers) into the Customer Agreement. If your legal-tech tool processes data of EU/UK data subjects, confirm the applicable DPA version is in place under your Customer Agreement — AWS does not make this a separate Artifact agreement, but you can download the DPA text from [aws.amazon.com/compliance/gdpr-center](https://aws.amazon.com/compliance/gdpr-center).

- **No CCPA-specific addendum exists in Artifact** — this is expected. AWS's CCPA obligations (acting as a "Service Provider") are covered by the AWS Data Processing Addendum / Customer Agreement. No separate action is required in Artifact, but you should verify this coverage is documented in your internal compliance records.

- **Account is not part of an AWS Organization.** If you have or plan to have multiple AWS accounts (common for enterprise legal-tech deployments with prod/staging separation), consider enrolling in AWS Organizations so that agreements like the BAA and future addenda can be managed at the org level rather than account-by-account.

- **Accepting IAM principal is not shown** in the Artifact UI for the accepted BAA. Consider using AWS CloudTrail to look up the exact IAM identity that accepted the agreement (event: `AcceptAgreement` in `artifact.amazonaws.com`) if a record of the accepting principal is required for audit purposes.