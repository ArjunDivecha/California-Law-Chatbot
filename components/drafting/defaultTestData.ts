/**
 * Default Test Data for Document Drafting
 * 
 * Populates template variables and instructions with test case data
 * from TEST_CASES.md for easy debugging and testing.
 */

export interface DefaultTestData {
  variables: Record<string, string>;
  instructions: string;
}

export const DEFAULT_TEST_DATA: Record<string, DefaultTestData> = {
  // Legal Research Memorandum - Test Case 1.1: Trust Creditor Protection
  legal_memo: {
    variables: {
      to: 'Sarah Chen, Partner',
      from: 'Michael Rodriguez, Associate',
      client_matter: 'Estate of John Smith / Creditor Claims Against Trust',
      date: new Date().toISOString().split('T')[0], // Today's date
      subject: 'Whether a revocable living trust protects assets from creditor claims after the settlor\'s death',
    },
    instructions: `A client created a revocable living trust in 2020 and transferred all assets into it. The client passed away in 2024. A creditor is now attempting to collect on a debt incurred by the client before death. The creditor claims the trust assets should be available to satisfy the debt. 

Research whether California law protects trust assets from creditor claims after the settlor's death, particularly for revocable trusts. Consider Probate Code sections 19000-19403 and relevant case law.`,
  },

  // Demand Letter - Test Case 2.1: Breach of Contract - Payment Demand
  demand_letter: {
    variables: {
      sender_name: 'Robert Thompson, Esq.',
      sender_firm: 'Thompson & Associates, LLP',
      sender_address: '1234 Market Street, Suite 500\nSan Francisco, CA 94102',
      recipient_name: 'ABC Construction Company, Inc.',
      recipient_address: '5678 Industrial Boulevard\nOakland, CA 94601',
      date: new Date().toISOString().split('T')[0], // Today's date
      demand_type: 'Payment of Debt',
      amount: '$45,000.00',
      response_deadline: '30',
      client_name: 'XYZ Materials Supply, Inc.',
    },
    instructions: `Our client, XYZ Materials Supply, provided construction materials to ABC Construction Company under a written contract dated March 15, 2024. The contract required payment within 30 days of delivery. Materials were delivered on April 1, 2024, totaling $45,000. ABC Construction has failed to pay despite multiple invoices and phone calls. The payment is now 90 days overdue. 

Draft a formal demand letter referencing the contract, delivery dates, and California Commercial Code provisions regarding payment obligations. Include threat of legal action and attorney fees under Civil Code section 1717.`,
  },

  // Client Advisory Letter - Test Case 3.1: Trust Administration - Creditor Claims
  client_letter: {
    variables: {
      attorney_name: 'Patricia Williams, Esq.',
      firm_name: 'Williams Estate Planning Group',
      firm_address: '3456 Financial Plaza, Suite 100\nLos Angeles, CA 90067',
      client_name: 'Mary Johnson',
      client_address: '789 Elm Street\nPasadena, CA 91101',
      date: new Date().toISOString().split('T')[0], // Today's date
      matter_description: 'Creditor Claim Against Your Father\'s Trust',
      salutation: 'Dear',
    },
    instructions: `Client Mary Johnson is the successor trustee of her father's revocable living trust. A creditor has filed a claim against the trust estate for a $25,000 debt incurred by her father before his death. The creditor claims the debt is valid and must be paid from trust assets. 

Client is unsure whether she must pay this claim. She wants to know her options and risks. The creditor has threatened to sue if not paid within 30 days.

Advise the client on:
1. Whether creditor claims can be enforced against trust assets
2. Her obligations as trustee
3. Options for handling the claim (pay, negotiate, dispute)
4. Risks of each option
5. Recommended course of action`,
  },

  // Motion to Compel Discovery - Test Case 4.1: Inadequate Responses to Interrogatories
  motion_compel: {
    variables: {
      court_name: 'Superior Court of California, County of Los Angeles',
      case_number: 'BC-2024-0123456',
      plaintiff: 'John Smith',
      defendant: 'ABC Corporation',
      moving_party: 'Plaintiff John Smith',
      responding_party: 'Defendant ABC Corporation',
      attorney_name: 'Maria Garcia, Esq.',
      firm_name: 'Garcia Litigation Group',
      bar_number: '123456',
      discovery_type: 'Form Interrogatories',
      discovery_set_number: 'One',
      discovery_date: '2024-09-15',
      response_date: '2024-10-15',
      hearing_date: '2024-12-15',
      hearing_time: '9:00 a.m.',
      department: 'Department 45',
      sanctions_amount: '$1,500.00',
    },
    instructions: `Defendant ABC Corporation served responses to Form Interrogatories, Set One on October 15, 2024. The responses to Interrogatories 15.1 (identity of persons with knowledge), 17.1 (witnesses), 50.1 (insurance), and 50.2 (settlement discussions) were evasive and incomplete. 

Interrogatory 15.1: Defendant listed only "various employees" without names or contact information.
Interrogatory 17.1: Defendant stated "to be determined" without identifying any witnesses.
Interrogatory 50.1: Defendant failed to provide policy limits or coverage details.
Interrogatory 50.2: Defendant gave a boilerplate objection without substantive response.

We met and conferred on November 1, 2024, but defendant refused to supplement. Draft a motion to compel further responses under CCP sections 2030.300 and 2030.220, seeking monetary sanctions.`,
  },
};

/**
 * Get default test data for a template
 */
export function getDefaultTestData(templateId: string): DefaultTestData | null {
  return DEFAULT_TEST_DATA[templateId] || null;
}
