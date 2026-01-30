/**
 * Revise Section API Endpoint
 * 
 * POST /api/revise-section - Revise a specific section of a document
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { GeneratedSection, ResearchPackage } from '../types';
import { reviseSection } from '../agents/drafterAgent';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Vercel function config
export const config = {
  maxDuration: 60, // 1 minute for section revision
};

interface ReviseSectionRequest {
  documentId: string;
  sectionId: string;
  revisionInstructions: string;
  currentContent: string;
  sectionName?: string;
  adjacentSections?: {
    before?: string;
    after?: string;
  };
  researchPackage?: ResearchPackage;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const request: ReviseSectionRequest = req.body;

    // Validate request
    if (!request.sectionId) {
      return res.status(400).json({ error: 'sectionId is required' });
    }

    if (!request.revisionInstructions) {
      return res.status(400).json({ error: 'revisionInstructions is required' });
    }

    if (!request.currentContent) {
      return res.status(400).json({ error: 'currentContent is required' });
    }

    console.log('✏️ Revise Section API: Starting revision');
    console.log(`   Section: ${request.sectionId}`);
    console.log(`   Instructions: ${request.revisionInstructions.substring(0, 100)}...`);

    // Build the current section object
    const currentSection: GeneratedSection = {
      sectionId: request.sectionId,
      sectionName: request.sectionName || request.sectionId,
      content: request.currentContent,
      wordCount: request.currentContent.split(/\s+/).length,
      citations: [],
      generatedAt: new Date().toISOString(),
      revisionCount: 0,
    };

    // Run the revision
    const revisedSection = await reviseSection(
      currentSection,
      request.revisionInstructions,
      request.researchPackage,
      request.adjacentSections
    );

    console.log('✅ Revise Section API: Complete');

    return res.status(200).json({
      sectionId: revisedSection.sectionId,
      revisedContent: revisedSection.content,
      wordCount: revisedSection.wordCount,
      changesSummary: `Section revised based on: "${request.revisionInstructions.substring(0, 50)}..."`,
      citationsChanged: revisedSection.citations,
    });

  } catch (error) {
    console.error('❌ Revise Section API error:', error);
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Revision failed',
    });
  }
}
