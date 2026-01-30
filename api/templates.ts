/**
 * Templates API Endpoint
 * 
 * GET /api/templates - List all available document templates
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

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
