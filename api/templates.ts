/**
 * Templates API Endpoint
 * 
 * GET /api/templates - List all available document templates
 * GET /api/templates?id=legal_memo - Get a specific template
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DocumentTemplate } from '../types';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Template index - in production, load from templates/index.json
const templates = [
  {
    id: 'legal_memo',
    name: 'Legal Research Memorandum',
    description: 'Internal legal memorandum analyzing a legal question with IRAC/CREAC structure',
    practiceAreas: ['all'],
    complexity: 'medium',
    estimatedTime: '60-90 seconds',
    variableCount: 5,
    sectionCount: 6,
  },
  {
    id: 'demand_letter',
    name: 'Demand Letter',
    description: 'Formal demand letter for payment, performance, or cease and desist',
    practiceAreas: ['civil_litigation', 'business'],
    complexity: 'low',
    estimatedTime: '30-45 seconds',
    variableCount: 10,
    sectionCount: 7,
  },
  {
    id: 'client_letter',
    name: 'Client Advisory Letter',
    description: 'Letter advising client on legal matter, options, and recommendations',
    practiceAreas: ['all'],
    complexity: 'low',
    estimatedTime: '30-45 seconds',
    variableCount: 8,
    sectionCount: 7,
  },
  {
    id: 'motion_compel',
    name: 'Motion to Compel Discovery',
    description: 'Motion to compel further responses to discovery requests under CCP sections 2030-2033',
    practiceAreas: ['civil_litigation'],
    complexity: 'high',
    estimatedTime: '90-120 seconds',
    variableCount: 16,
    sectionCount: 10,
  },
];

// Template definitions - in production, load from templates/*.json
const templateData: Record<string, DocumentTemplate> = {
  legal_memo: {
    id: 'legal_memo',
    name: 'Legal Research Memorandum',
    description: 'Internal legal memorandum analyzing a legal question',
    practiceAreas: ['all'],
    cebCategories: ['trusts_estates', 'family_law', 'business_litigation', 'business_entities', 'business_transactions'],
    variables: [
      { id: 'to', name: 'To', type: 'text', required: true, placeholder: 'Partner Name' },
      { id: 'from', name: 'From', type: 'text', required: true, placeholder: 'Associate Name' },
      { id: 'client_matter', name: 'Client/Matter', type: 'text', required: true, placeholder: 'Client Name / Matter Description' },
      { id: 'date', name: 'Date', type: 'date', required: true, default: 'today' },
      { id: 'subject', name: 'Re (Subject)', type: 'text', required: true, placeholder: 'Subject of memorandum' },
    ],
    sections: [
      {
        id: 'header',
        name: 'Header',
        order: 1,
        type: 'template',
        content: '# MEMORANDUM\n\n**TO:** {{to}}\n\n**FROM:** {{from}}\n\n**DATE:** {{date}}\n\n**RE:** {{subject}}\n\n**CLIENT/MATTER:** {{client_matter}}\n\n---',
        required: true,
        editable: false,
      },
      {
        id: 'question_presented',
        name: 'Question Presented',
        order: 2,
        type: 'generated',
        promptInstruction: 'Write a clear, concise statement of the legal question(s) to be analyzed. Frame as a question that can be answered yes/no or with a specific legal conclusion. Include key facts that affect the answer.',
        maxLengthWords: 150,
        required: true,
      },
      {
        id: 'brief_answer',
        name: 'Brief Answer',
        order: 3,
        type: 'generated',
        promptInstruction: 'Provide a direct answer to the question presented, followed by a brief explanation of the key reasons. This should be 2-4 sentences summarizing the conclusion.',
        maxLengthWords: 200,
        required: true,
      },
      {
        id: 'facts',
        name: 'Statement of Facts',
        order: 4,
        type: 'generated',
        promptInstruction: 'Present the relevant facts in a clear, objective manner. Include all facts that are legally significant to the analysis. Use past tense. Do not include legal conclusions.',
        maxLengthWords: 500,
        required: true,
      },
      {
        id: 'analysis',
        name: 'Analysis',
        order: 5,
        type: 'generated',
        promptInstruction: 'Provide detailed legal analysis applying the law to the facts. Structure with clear subheadings for each issue. Cite authorities for all legal propositions. Address counterarguments where relevant. Use IRAC or CREAC structure.',
        maxLengthWords: 2000,
        required: true,
        subsectionsAllowed: true,
      },
      {
        id: 'conclusion',
        name: 'Conclusion',
        order: 6,
        type: 'generated',
        promptInstruction: 'Summarize the analysis and provide practical recommendations. What should the client do? What are the risks? Are there alternative approaches?',
        maxLengthWords: 300,
        required: true,
      },
    ],
    formatting: {
      fontFamily: 'Times New Roman',
      fontSize: 12,
      lineSpacing: 'double',
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      pageNumbers: true,
      headerStyle: 'left',
    },
    metadata: {
      version: '1.0',
      created: '2026-01-30',
      author: 'California Law Chatbot',
    },
  },
  demand_letter: {
    id: 'demand_letter',
    name: 'Demand Letter',
    description: 'Formal demand letter for payment, performance, or cease and desist',
    practiceAreas: ['civil_litigation', 'business'],
    cebCategories: ['business_litigation', 'business_transactions'],
    variables: [
      { id: 'sender_name', name: 'Sender Name', type: 'text', required: true, placeholder: 'Attorney Name' },
      { id: 'sender_firm', name: 'Firm Name', type: 'text', required: false, placeholder: 'Law Firm Name' },
      { id: 'sender_address', name: 'Sender Address', type: 'textarea', required: true, placeholder: '123 Main St\nCity, CA 90000' },
      { id: 'recipient_name', name: 'Recipient Name', type: 'text', required: true, placeholder: 'Recipient\'s Full Name' },
      { id: 'recipient_address', name: 'Recipient Address', type: 'textarea', required: true, placeholder: '456 Oak Ave\nCity, CA 90000' },
      { id: 'date', name: 'Date', type: 'date', required: true, default: 'today' },
      { id: 'demand_type', name: 'Type of Demand', type: 'select', required: true, options: ['Payment of Debt', 'Breach of Contract', 'Cease and Desist', 'Return of Property', 'Performance of Agreement'] },
      { id: 'amount', name: 'Amount Demanded (if applicable)', type: 'text', required: false, placeholder: '$10,000.00' },
      { id: 'response_deadline', name: 'Response Deadline (days)', type: 'number', required: true, default: '30' },
      { id: 'client_name', name: 'Client Name', type: 'text', required: true, placeholder: 'Your Client\'s Name' },
    ],
    sections: [
      {
        id: 'letterhead',
        name: 'Letterhead',
        order: 1,
        type: 'template',
        content: '**{{sender_firm}}**\n\n{{sender_address}}\n\n---\n\n{{date}}\n\n**VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED**\n\n{{recipient_name}}\n{{recipient_address}}\n\n**Re: Demand on Behalf of {{client_name}}**\n\nDear {{recipient_name}}:',
        required: true,
        editable: false,
      },
      {
        id: 'introduction',
        name: 'Introduction',
        order: 2,
        type: 'generated',
        promptInstruction: 'Write a formal opening paragraph that identifies the sender as counsel, states the purpose of the letter, and sets a professional but firm tone.',
        maxLengthWords: 100,
        required: true,
      },
      {
        id: 'factual_background',
        name: 'Factual Background',
        order: 3,
        type: 'generated',
        promptInstruction: 'Describe the relevant facts that give rise to the demand. Be specific about dates, agreements, and actions taken.',
        maxLengthWords: 300,
        required: true,
      },
      {
        id: 'legal_basis',
        name: 'Legal Basis',
        order: 4,
        type: 'generated',
        promptInstruction: 'Explain the legal basis for the demand. Cite applicable California statutes, case law, or contractual provisions.',
        maxLengthWords: 300,
        required: true,
      },
      {
        id: 'demand',
        name: 'Specific Demand',
        order: 5,
        type: 'generated',
        promptInstruction: 'State the specific demand clearly. What exactly must the recipient do? By when?',
        maxLengthWords: 200,
        required: true,
      },
      {
        id: 'consequences',
        name: 'Consequences of Non-Compliance',
        order: 6,
        type: 'generated',
        promptInstruction: 'Explain the consequences if the recipient fails to comply. Reference potential legal action, damages, attorney fees.',
        maxLengthWords: 200,
        required: true,
      },
      {
        id: 'closing',
        name: 'Closing',
        order: 7,
        type: 'template',
        content: 'Please govern yourself accordingly.\n\nVery truly yours,\n\n{{sender_firm}}\n\n\n_______________________\n{{sender_name}}\n\ncc: {{client_name}}',
        required: true,
        editable: true,
      },
    ],
    formatting: {
      fontFamily: 'Times New Roman',
      fontSize: 12,
      lineSpacing: 'single',
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      pageNumbers: false,
      headerStyle: 'left',
    },
    metadata: {
      version: '1.0',
      created: '2026-01-30',
      author: 'California Law Chatbot',
    },
  },
  client_letter: {
    id: 'client_letter',
    name: 'Client Advisory Letter',
    description: 'Letter advising client on legal matter, options, and recommendations',
    practiceAreas: ['all'],
    cebCategories: ['trusts_estates', 'family_law', 'business_litigation', 'business_entities', 'business_transactions'],
    variables: [
      { id: 'attorney_name', name: 'Attorney Name', type: 'text', required: true, placeholder: 'Your Name' },
      { id: 'firm_name', name: 'Firm Name', type: 'text', required: false, placeholder: 'Law Firm Name' },
      { id: 'firm_address', name: 'Firm Address', type: 'textarea', required: true, placeholder: '123 Main St\nCity, CA 90000' },
      { id: 'client_name', name: 'Client Name', type: 'text', required: true, placeholder: 'Client\'s Name' },
      { id: 'client_address', name: 'Client Address', type: 'textarea', required: true, placeholder: '456 Oak Ave\nCity, CA 90000' },
      { id: 'date', name: 'Date', type: 'date', required: true, default: 'today' },
      { id: 'matter_description', name: 'Matter Description', type: 'text', required: true, placeholder: 'Brief description of the matter' },
      { id: 'salutation', name: 'Salutation', type: 'text', required: true, default: 'Dear', placeholder: 'Dear' },
    ],
    sections: [
      {
        id: 'letterhead',
        name: 'Letterhead',
        order: 1,
        type: 'template',
        content: '**{{firm_name}}**\n\n{{firm_address}}\n\n---\n\n{{date}}\n\n**PRIVILEGED AND CONFIDENTIAL**\n**ATTORNEY-CLIENT COMMUNICATION**\n\n{{client_name}}\n{{client_address}}\n\n**Re: {{matter_description}}**\n\n{{salutation}} {{client_name}}:',
        required: true,
        editable: false,
      },
      {
        id: 'introduction',
        name: 'Introduction',
        order: 2,
        type: 'generated',
        promptInstruction: 'Write a warm but professional opening that thanks the client and states the purpose of the letter.',
        maxLengthWords: 100,
        required: true,
      },
      {
        id: 'facts_summary',
        name: 'Summary of Facts',
        order: 3,
        type: 'generated',
        promptInstruction: 'Summarize the key facts as you understand them from the client.',
        maxLengthWords: 300,
        required: true,
      },
      {
        id: 'legal_analysis',
        name: 'Legal Analysis',
        order: 4,
        type: 'generated',
        promptInstruction: 'Provide clear, accessible legal analysis. Explain the relevant law in terms the client can understand.',
        maxLengthWords: 500,
        required: true,
        subsectionsAllowed: true,
      },
      {
        id: 'options',
        name: 'Options and Recommendations',
        order: 5,
        type: 'generated',
        promptInstruction: 'Present the client\'s options clearly with pros and cons for each. Provide your recommendation.',
        maxLengthWords: 400,
        required: true,
        subsectionsAllowed: true,
      },
      {
        id: 'next_steps',
        name: 'Next Steps',
        order: 6,
        type: 'generated',
        promptInstruction: 'Outline the recommended next steps. What does the client need to do?',
        maxLengthWords: 200,
        required: true,
      },
      {
        id: 'closing',
        name: 'Closing',
        order: 7,
        type: 'template',
        content: 'Please review this letter carefully and let me know if you have any questions.\n\nVery truly yours,\n\n{{firm_name}}\n\n\n_______________________\n{{attorney_name}}',
        required: true,
        editable: true,
      },
    ],
    formatting: {
      fontFamily: 'Times New Roman',
      fontSize: 12,
      lineSpacing: 'single',
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      pageNumbers: false,
      headerStyle: 'left',
    },
    metadata: {
      version: '1.0',
      created: '2026-01-30',
      author: 'California Law Chatbot',
    },
  },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const { id } = req.query;

    // If id is provided, return specific template
    if (id && typeof id === 'string') {
      const template = templateData[id];
      if (!template) {
        return res.status(404).json({ error: `Template not found: ${id}` });
      }
      return res.status(200).json(template);
    }

    // Otherwise, return list of templates
    return res.status(200).json({
      templates,
      total: templates.length,
    });
  } catch (error) {
    console.error('Templates API error:', error);
    return res.status(500).json({
      error: 'Failed to load templates',
    });
  }
}
