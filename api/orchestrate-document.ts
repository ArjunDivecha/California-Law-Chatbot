/**
 * Orchestrate Document API Endpoint
 * 
 * POST /api/orchestrate-document - Generate a legal document using multi-agent system
 * 
 * Uses Server-Sent Events (SSE) for streaming progress updates.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DraftRequest, GeneratedSection, DocumentStatus } from '../types';
import { orchestrateDocument } from '../agents/orchestrator';

// Vercel function config
export const config = {
  maxDuration: 120, // 2 minutes for full document generation
};

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

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Helper to send SSE events
  const sendEvent = (type: string, data: unknown) => {
    res.write(`data: ${JSON.stringify({ type, ...data as object })}\n\n`);
  };

  try {
    // Parse request body
    const request: DraftRequest = req.body;

    // Validate request
    if (!request.documentType) {
      sendEvent('error', { error: 'documentType is required', recoverable: false });
      return res.end();
    }

    if (!request.userInstructions) {
      sendEvent('error', { error: 'userInstructions is required', recoverable: false });
      return res.end();
    }

    console.log('📄 Orchestrate Document API: Starting generation');
    console.log(`   Type: ${request.documentType}`);
    console.log(`   Instructions: ${request.userInstructions.substring(0, 100)}...`);

    // Send initial progress
    sendEvent('progress', {
      phase: 'initializing',
      message: 'Starting document generation...',
      percentComplete: 5,
    });

    // Run the orchestrator with callbacks
    const result = await orchestrateDocument(request, {
      onProgress: (event) => {
        sendEvent('progress', event);
      },
      onSectionComplete: (section: GeneratedSection) => {
        sendEvent('section_complete', {
          sectionId: section.sectionId,
          sectionName: section.sectionName,
          content: section.content,
          wordCount: section.wordCount,
        });
      },
      onError: (error: string, recoverable: boolean) => {
        sendEvent('error', { error, recoverable });
      },
    });

    // Send completion event
    sendEvent('document_complete', {
      document: result.document,
      verificationReport: result.verificationReport,
      citations: result.citationReport,
    });

    console.log('✅ Orchestrate Document API: Complete');
    return res.end();

  } catch (error) {
    console.error('❌ Orchestrate Document API error:', error);
    
    sendEvent('error', {
      error: error instanceof Error ? error.message : 'Document generation failed',
      recoverable: false,
      suggestion: 'Please try again. If the problem persists, try a simpler request.',
    });
    
    return res.end();
  }
}
