# Document Drafting Test Cases

This document provides comprehensive test cases for all four document types in the California Law Chatbot document drafting system.

## Test Environment
- **Preview URL**: `https://california-law-chatbot-2hnmlpn49.vercel.app`
- **Branch**: `feature/document-drafting`
- **Expected Duration**: 30-120 seconds per document (varies by complexity)

---

## 1. Legal Research Memorandum (`legal_memo`)

### Test Case 1.1: Trust Creditor Protection
**Purpose**: Test IRAC/CREAC structure with trusts & estates law

**Template Variables:**
- **To**: Sarah Chen, Partner
- **From**: Michael Rodriguez, Associate
- **Client/Matter**: Estate of John Smith / Creditor Claims Against Trust
- **Date**: Today's date
- **Re (Subject)**: Whether a revocable living trust protects assets from creditor claims after the settlor's death

**Query/Context:**
```
A client created a revocable living trust in 2020 and transferred all assets into it. The client passed away in 2024. A creditor is now attempting to collect on a debt incurred by the client before death. The creditor claims the trust assets should be available to satisfy the debt. 

Research whether California law protects trust assets from creditor claims after the settlor's death, particularly for revocable trusts. Consider Probate Code sections 19000-19403 and relevant case law.
```

**Expected Sections:**
1. Header (template)
2. Question Presented - Should frame the legal issue clearly
3. Brief Answer - Direct answer with key reasons
4. Statement of Facts - Objective facts about the trust and creditor claim
5. Analysis - IRAC/CREAC structure with citations to Probate Code and cases
6. Conclusion - Practical recommendations

**Validation Points:**
- ✅ CEB sources referenced (trusts_estates category)
- ✅ California Probate Code citations (e.g., Prob. Code § 19000)
- ✅ Case law citations if applicable
- ✅ Clear IRAC/CREAC structure
- ✅ Word count within limits per section

---

### Test Case 1.2: Family Law - Prenuptial Agreement Enforceability
**Purpose**: Test family law research with code section analysis

**Template Variables:**
- **To**: David Kim, Partner
- **From**: Jennifer Martinez, Associate
- **Client/Matter**: Jane Doe / Prenuptial Agreement Dispute
- **Date**: Today's date
- **Re (Subject)**: Enforceability of prenuptial agreement executed 7 days before marriage

**Query/Context:**
```
Client signed a prenuptial agreement 7 days before her wedding. The agreement was prepared by her fiancé's attorney, and she did not have independent counsel. The agreement waives all spousal support rights. Client is now seeking divorce and wants to challenge the agreement. 

Research whether the 7-day execution window violates Family Code section 1615's timing requirements and whether lack of independent counsel affects enforceability.
```

**Expected Sections:**
1. Header (template)
2. Question Presented - Focus on timing and independent counsel issues
3. Brief Answer - Address both Family Code § 1615 timing and counsel requirement
4. Statement of Facts - Timeline of agreement execution and wedding
5. Analysis - Family Code § 1615 analysis, case law on timing, independent counsel requirement
6. Conclusion - Likelihood of successful challenge

**Validation Points:**
- ✅ Family Code § 1615 citation and analysis
- ✅ CEB family law sources
- ✅ Case law on timing requirements
- ✅ Discussion of independent counsel requirement
- ✅ Practical assessment of enforceability

---

## 2. Demand Letter (`demand_letter`)

### Test Case 2.1: Breach of Contract - Payment Demand
**Purpose**: Test demand letter for commercial debt collection

**Template Variables:**
- **Sender Name**: Robert Thompson, Esq.
- **Firm Name**: Thompson & Associates, LLP
- **Sender Address**: 1234 Market Street, Suite 500\nSan Francisco, CA 94102
- **Recipient Name**: ABC Construction Company, Inc.
- **Recipient Address**: 5678 Industrial Boulevard\nOakland, CA 94601
- **Date**: Today's date
- **Type of Demand**: Payment of Debt
- **Amount Demanded**: $45,000.00
- **Response Deadline (days)**: 30
- **Client Name**: XYZ Materials Supply, Inc.

**Query/Context:**
```
Our client, XYZ Materials Supply, provided construction materials to ABC Construction Company under a written contract dated March 15, 2024. The contract required payment within 30 days of delivery. Materials were delivered on April 1, 2024, totaling $45,000. ABC Construction has failed to pay despite multiple invoices and phone calls. The payment is now 90 days overdue. 

Draft a formal demand letter referencing the contract, delivery dates, and California Commercial Code provisions regarding payment obligations. Include threat of legal action and attorney fees under Civil Code section 1717.
```

**Expected Sections:**
1. Letterhead (template)
2. Introduction - Identify sender as counsel, state purpose
3. Factual Background - Contract details, delivery date, payment terms
4. Legal Basis - Commercial Code payment obligations, contract terms
5. Specific Demand - $45,000 payment within 30 days
6. Consequences of Non-Compliance - Legal action, damages, attorney fees under CC § 1717
7. Closing (template, editable)

**Validation Points:**
- ✅ Professional but firm tone
- ✅ Specific contract details and dates
- ✅ California Commercial Code citations
- ✅ Civil Code § 1717 attorney fees reference
- ✅ Clear deadline (30 days)
- ✅ Specific dollar amount
- ✅ Threat of legal action

---

### Test Case 2.2: Cease and Desist - Trademark Infringement
**Purpose**: Test demand letter for intellectual property protection

**Template Variables:**
- **Sender Name**: Lisa Park, Esq.
- **Firm Name**: Park Intellectual Property Law Group
- **Sender Address**: 8900 Wilshire Boulevard, Suite 200\nBeverly Hills, CA 90211
- **Recipient Name**: TechStart Solutions, LLC
- **Recipient Address**: 123 Tech Park Drive\nSan Jose, CA 95110
- **Date**: Today's date
- **Type of Demand**: Cease and Desist
- **Amount Demanded**: (leave blank)
- **Response Deadline (days)**: 14
- **Client Name**: InnovateCorp, Inc.

**Query/Context:**
```
Our client, InnovateCorp, owns a registered trademark "INNOVATE" (U.S. Reg. No. 4,567,890) for software services. TechStart Solutions is using "INNOVATE TECH" for similar software services, creating consumer confusion. Our client has sent informal requests to stop, but TechStart continues using the mark.

Draft a cease and desist letter demanding immediate cessation of trademark infringement, destruction of infringing materials, and an accounting. Reference Lanham Act and California Business & Professions Code section 17200 (unfair competition).
```

**Expected Sections:**
1. Letterhead (template)
2. Introduction - Identify sender, state purpose (trademark enforcement)
3. Factual Background - Trademark registration, client's use, TechStart's infringing use
4. Legal Basis - Lanham Act, B&P Code § 17200, likelihood of confusion
5. Specific Demand - Cease use, destroy materials, provide accounting
6. Consequences of Non-Compliance - Federal and state court action, damages, injunctive relief
7. Closing (template, editable)

**Validation Points:**
- ✅ Trademark registration number referenced
- ✅ Lanham Act mentioned
- ✅ California B&P Code § 17200 cited
- ✅ Likelihood of confusion analysis
- ✅ Specific demands (cease, destroy, account)
- ✅ Shorter deadline (14 days) appropriate for IP
- ✅ Threat of federal and state court action

---

## 3. Client Advisory Letter (`client_letter`)

### Test Case 3.1: Trust Administration - Creditor Claims
**Purpose**: Test client communication for trusts & estates matter

**Template Variables:**
- **Attorney Name**: Patricia Williams, Esq.
- **Firm Name**: Williams Estate Planning Group
- **Firm Address**: 3456 Financial Plaza, Suite 100\nLos Angeles, CA 90067
- **Client Name**: Mary Johnson
- **Client Address**: 789 Elm Street\nPasadena, CA 91101
- **Date**: Today's date
- **Matter Description**: Creditor Claim Against Your Father's Trust
- **Salutation**: Dear

**Query/Context:**
```
Client Mary Johnson is the successor trustee of her father's revocable living trust. A creditor has filed a claim against the trust estate for a $25,000 debt incurred by her father before his death. The creditor claims the debt is valid and must be paid from trust assets. 

Client is unsure whether she must pay this claim. She wants to know her options and risks. The creditor has threatened to sue if not paid within 30 days.

Advise the client on:
1. Whether creditor claims can be enforced against trust assets
2. Her obligations as trustee
3. Options for handling the claim (pay, negotiate, dispute)
4. Risks of each option
5. Recommended course of action
```

**Expected Sections:**
1. Letterhead (template)
2. Introduction - Thank client, acknowledge concern
3. Summary of Facts - Trust administration, creditor claim, deadline
4. Legal Analysis - Probate Code on creditor claims, trustee duties, asset protection
5. Options and Recommendations - Pay, negotiate, dispute with pros/cons
6. Next Steps - Recommended action, timeline, what client needs to do
7. Closing (template, editable)

**Validation Points:**
- ✅ Warm but professional tone
- ✅ Clear explanation of legal concepts
- ✅ Multiple options presented
- ✅ Pros and cons for each option
- ✅ Clear recommendation
- ✅ Actionable next steps
- ✅ Appropriate for non-lawyer audience

---

### Test Case 3.2: Business Entity - LLC Dissolution
**Purpose**: Test business law client advisory

**Template Variables:**
- **Attorney Name**: James Anderson, Esq.
- **Firm Name**: Anderson Business Law, PC
- **Firm Address**: 456 Corporate Center Drive\nIrvine, CA 92614
- **Client Name**: TechVentures, LLC (represented by Managing Member)
- **Client Address**: 1234 Innovation Way\nIrvine, CA 92618
- **Date**: Today's date
- **Matter Description**: Dissolution of TechVentures, LLC
- **Salutation**: Dear Members

**Query/Context:**
```
TechVentures, LLC has three members. Two members want to dissolve the LLC due to irreconcilable differences. The third member opposes dissolution. The operating agreement does not specify dissolution procedures. The LLC has assets (equipment worth $50,000) and liabilities (a $20,000 business loan).

Advise the members on:
1. Whether dissolution can proceed without unanimous consent
2. Procedures under California Corporations Code
3. Distribution of assets and payment of liabilities
4. Tax implications
5. Recommended approach
```

**Expected Sections:**
1. Letterhead (template)
2. Introduction - Acknowledge situation, state purpose
3. Summary of Facts - LLC structure, member dispute, assets/liabilities
4. Legal Analysis - Corp. Code dissolution requirements, operating agreement, member rights
5. Options and Recommendations - Voluntary dissolution, buyout, court-ordered dissolution
6. Next Steps - Required filings, tax considerations, timeline
7. Closing (template, editable)

**Validation Points:**
- ✅ Corporations Code citations
- ✅ Operating agreement analysis
- ✅ Tax implications mentioned
- ✅ Multiple resolution options
- ✅ Clear recommendation
- ✅ Filing requirements explained
- ✅ Practical business considerations

---

## 4. Motion to Compel Discovery (`motion_compel`)

### Test Case 4.1: Inadequate Responses to Interrogatories
**Purpose**: Test complex litigation motion with CCP citations

**Template Variables:**
- **Case Name**: Smith v. ABC Corporation
- **Court**: Superior Court of California, County of Los Angeles
- **Case Number**: BC-2024-0123456
- **Department**: Department 45
- **Moving Party**: Plaintiff John Smith
- **Responding Party**: Defendant ABC Corporation
- **Motion Date**: (leave blank - will be set by court)
- **Hearing Date**: (leave blank - will be set by court)
- **Attorney Name**: Maria Garcia, Esq.
- **Firm Name**: Garcia Litigation Group
- **Firm Address**: 5678 Court Street, Suite 300\nLos Angeles, CA 90012
- **Bar Number**: 123456
- **Phone**: (213) 555-0100
- **Email**: mgarcia@garcialit.com
- **Opposing Counsel**: Robert Lee, Esq.
- **Discovery Requests**: Form Interrogatories, Set One (15.1, 17.1, 50.1, 50.2)
- **Response Date**: October 15, 2024
- **Meet and Confer Date**: November 1, 2024

**Query/Context:**
```
Defendant ABC Corporation served responses to Form Interrogatories on October 15, 2024. The responses to Interrogatories 15.1 (identity of persons with knowledge), 17.1 (witnesses), 50.1 (insurance), and 50.2 (settlement discussions) were evasive and incomplete. 

Interrogatory 15.1: Defendant listed only "various employees" without names or contact information.
Interrogatory 17.1: Defendant stated "to be determined" without identifying any witnesses.
Interrogatory 50.1: Defendant failed to provide policy limits or coverage details.
Interrogatory 50.2: Defendant gave a boilerplate objection without substantive response.

We met and conferred on November 1, 2024, but defendant refused to supplement. Draft a motion to compel further responses under CCP sections 2030.300 and 2030.220, seeking monetary sanctions.
```

**Expected Sections:**
1. Caption (template)
2. Notice of Motion - Hearing date, relief sought
3. Memorandum of Points and Authorities - Legal basis (CCP §§ 2030.300, 2030.220)
4. Statement of Facts - Discovery served, responses received, deficiencies, meet and confer
5. Argument - Why responses are inadequate, legal standard, case law
6. Separate Statement - Each interrogatory, response, why inadequate, authority
7. Declaration - Attorney declaration supporting facts
8. Proposed Order - Granting motion, ordering further responses, sanctions
9. Proof of Service (template)

**Validation Points:**
- ✅ Proper court caption format
- ✅ CCP §§ 2030.300, 2030.220 cited correctly
- ✅ Separate statement format (per CCP § 2030.300(b))
- ✅ Meet and confer requirement satisfied
- ✅ Specific deficiencies identified for each interrogatory
- ✅ Monetary sanctions requested
- ✅ Proper declaration format
- ✅ Proposed order included

---

### Test Case 4.2: Failure to Produce Documents
**Purpose**: Test document production motion

**Template Variables:**
- **Case Name**: Johnson v. XYZ Manufacturing, Inc.
- **Court**: Superior Court of California, County of Orange
- **Case Number**: 30-2024-0127890
- **Department**: Department C-12
- **Moving Party**: Plaintiff Sarah Johnson
- **Responding Party**: Defendant XYZ Manufacturing, Inc.
- **Motion Date**: (leave blank)
- **Hearing Date**: (leave blank)
- **Attorney Name**: Thomas Chen, Esq.
- **Firm Name**: Chen & Associates
- **Firm Address**: 2345 Harbor Boulevard, Suite 400\nCosta Mesa, CA 92626
- **Bar Number**: 234567
- **Phone**: (714) 555-0200
- **Email**: tchen@chenlaw.com
- **Opposing Counsel**: Jennifer White, Esq.
- **Discovery Requests**: Request for Production of Documents, Set One (Nos. 1-25)
- **Response Date**: September 20, 2024
- **Meet and Confer Date**: October 10, 2024

**Query/Context:**
```
Defendant XYZ Manufacturing served responses to Request for Production on September 20, 2024. Defendant objected to nearly all requests with boilerplate objections (overbroad, vague, not reasonably calculated to lead to admissible evidence) without producing any documents.

Key requests at issue:
- Request 1: All contracts between defendant and plaintiff
- Request 5: All communications between defendant and plaintiff
- Request 12: Financial records showing payments to plaintiff
- Request 18: Employee personnel files for individuals who worked with plaintiff
- Request 22: All documents related to plaintiff's termination

Defendant's objections are meritless. The requests are specific, relevant, and proportional. We met and conferred on October 10, 2024, but defendant maintained all objections.

Draft a motion to compel production under CCP sections 2031.310 and 2031.320, seeking production of documents and monetary sanctions.
```

**Expected Sections:**
1. Caption (template)
2. Notice of Motion - Hearing date, relief sought
3. Memorandum of Points and Authorities - CCP §§ 2031.310, 2031.320, relevance standard
4. Statement of Facts - Requests served, responses received, objections, meet and confer
5. Argument - Why objections are meritless, relevance, proportionality, case law
6. Separate Statement - Each request, response/objection, why objection fails, authority
7. Declaration - Attorney declaration with exhibits
8. Proposed Order - Granting motion, ordering production, sanctions
9. Proof of Service (template)

**Validation Points:**
- ✅ CCP §§ 2031.310, 2031.320 cited correctly
- ✅ Separate statement for document requests
- ✅ Relevance and proportionality arguments
- ✅ Specific requests identified
- ✅ Why objections are meritless explained
- ✅ Monetary sanctions requested
- ✅ Proper declaration with exhibits
- ✅ Proposed order included

---

## Testing Checklist

For each test case, verify:

### Functionality
- [ ] Document generation completes without errors
- [ ] All sections are generated (check section count matches template)
- [ ] Template variables are properly substituted in letterhead/closing
- [ ] Research phase completes (CEB, CourtListener searches)
- [ ] Citations are properly formatted
- [ ] Word counts are within limits per section

### Content Quality
- [ ] Legal analysis is accurate and relevant
- [ ] California law citations are correct
- [ ] Case law citations are real and relevant
- [ ] Tone is appropriate for document type
- [ ] Recommendations are practical and actionable

### UI/UX
- [ ] Orchestration visual shows all phases
- [ ] Document preview renders correctly
- [ ] Sections are editable inline (WYSIWYG)
- [ ] Export to DOCX works
- [ ] Export to PDF works
- [ ] Document saves properly

### Performance
- [ ] Generation completes within estimated time
- [ ] No timeout errors
- [ ] Research phase doesn't hang
- [ ] Streaming works (if applicable)

---

## Quick Test Script

**Fastest test (30-45 seconds):**
1. Client Advisory Letter - Trust Creditor Protection (Test Case 3.1)

**Medium complexity (60-90 seconds):**
2. Legal Research Memorandum - Trust Creditor Protection (Test Case 1.1)
3. Demand Letter - Payment Demand (Test Case 2.1)

**Most complex (90-120 seconds):**
4. Motion to Compel - Interrogatories (Test Case 4.1)

---

## Notes

- All test cases use realistic California legal scenarios
- Template variables should be filled completely for best results
- Query/Context should be detailed to ensure accurate research
- Expected sections match the template definitions in `api/templates.ts`
- Validation points ensure both functionality and legal accuracy
