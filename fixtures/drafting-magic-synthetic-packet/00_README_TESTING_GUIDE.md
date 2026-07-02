# Drafting Magic Synthetic Test Packet

All documents in this folder are synthetic. They intentionally use fake but realistic names, addresses, and account-like facts so the local privacy filter and Drafting Magic workflow can be tested without real client data.

## Suggested Upload Mapping

| Drafting Magic slot | Upload file | Expected behavior |
| --- | --- | --- |
| Revocable living trust | `01_REVOCABLE_LIVING_TRUST__Chen_Family_2016.docx` | Ready; trust identity, trustees, funding, property character, incapacity units |
| Pour-over will | `02_POUR_OVER_WILL__Maya_Chen_Trust_Date_Mismatch.pdf` | Ready; trust name/date mismatch, executor, residue, property silence |
| Advance directive | `03_ADVANCE_HEALTH_CARE_DIRECTIVE__Priya_First_Agent.docx` | Ready; AHCD agent-order mismatch and HIPAA modernization issue |
| Financial POA | `04_DURABLE_FINANCIAL_POA__Daniel_First_Agent.docx` | Ready; effective immediately, financial agent mismatch, gifting limits |
| Prenup | `05_PRENUPTIAL_AGREEMENT__Separate_Property_Constraints.pdf` | Ready; separate/community property, waivers, transfer limits |

Paste `06_NEW_LAW_AND_ATTORNEY_INSTRUCTION__Packet_Reconciliation.txt` into the **Attorney update or new law** box, then click **Generate comparison**.

## Extra Negative/Edge Tests

- `07_SIGNING_MEMO__Conflicting_Execution_Checklist.md`: paste into any source card to test stale matrix regeneration and review flags.
- `08_LEGACY_DOC_FORMAT__Unsupported_Extraction.doc`: upload to confirm unsupported `.doc` extraction becomes **Needs review**.
- `09_SCANNED_PDF_WARNING__Image_Only_Addendum.pdf`: upload to confirm image-only PDFs become **Needs review** until OCR exists.

## Expected Issues

- Pour-over will names `Maya Chen Living Trust dated May 21, 2016`; trust document says `Chen Family Revocable Trust dated May 12, 2016`.
- Trust successor trustee order differs from AHCD and financial POA agent order.
- Prenup preserves Solara AI shares as separate property, while the trust funding schedule lacks a property-character legend.
- Trust incapacity requires two physicians or court; POA is effective immediately; AHCD turns on inability to make health care decisions.
- AHCD uses old HIPAA/privacy wording and omits digital health portals.

## Files

- `01_REVOCABLE_LIVING_TRUST__Chen_Family_2016.docx` - Base trust with trustee order, funding schedule, property-character ambiguity, and incapacity trigger.
- `02_POUR_OVER_WILL__Maya_Chen_Trust_Date_Mismatch.pdf` - Selectable PDF with pour-over trust identity mismatch.
- `03_ADVANCE_HEALTH_CARE_DIRECTIVE__Priya_First_Agent.docx` - AHCD with Priya Shah first, HIPAA modernization issue, and health care decision trigger.
- `04_DURABLE_FINANCIAL_POA__Daniel_First_Agent.docx` - Financial POA with Daniel first, immediate effectiveness, gifting and transfer limits.
- `05_PRENUPTIAL_AGREEMENT__Separate_Property_Constraints.pdf` - Prenup with separate/community property, spousal waivers, reimbursement, and trust-funding limits.
- `06_NEW_LAW_AND_ATTORNEY_INSTRUCTION__Packet_Reconciliation.txt` - Paste into the new law/instruction field.
- `07_SIGNING_MEMO__Conflicting_Execution_Checklist.md` - Paste/upload as an edge source to force stale analysis and review flags.
- `08_LEGACY_DOC_FORMAT__Unsupported_Extraction.doc` - Unsupported legacy extension warning test.
- `09_SCANNED_PDF_WARNING__Image_Only_Addendum.pdf` - Image-only scanned PDF warning test.
