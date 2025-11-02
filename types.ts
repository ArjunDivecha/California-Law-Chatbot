export enum MessageRole {
  USER = 'user',
  BOT = 'bot',
}

export type SourceMode = 'ceb-only' | 'ai-only' | 'hybrid';

export interface Source {
  title: string;
  url: string;
  id?: string; // For citation mapping [id]
  excerpt?: string; // Source excerpt for verification
}

export interface CEBSource extends Source {
  isCEB: true;
  category: 'trusts_estates' | 'family_law' | 'business_litigation';
  cebCitation: string;
  pageNumber?: number;
  section?: string;
  confidence: number; // Similarity score from vector search (0-1)
}

export interface Claim {
  text: string;
  cites: string[]; // Array of source IDs
  kind: 'statute' | 'case' | 'fact';
}

export interface VerificationReport {
  coverage: number; // supported_claims / total_claims (0.0 to 1.0)
  minSupport: number; // Minimum # quotes per claim
  ambiguity: boolean; // Conflicting or generic sources
  supportedClaims: Claim[];
  unsupportedClaims: Claim[];
  verifiedQuotes: Array<{ claim: string; quotes: string[]; sourceId: string }>;
}

export type VerificationStatus = 'verified' | 'partially_verified' | 'refusal' | 'unverified' | 'not_needed';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  sources?: (Source | CEBSource)[];
  verificationStatus?: VerificationStatus;
  verificationReport?: VerificationReport;
  claims?: Claim[]; // Extracted claims for verification
  isCEBBased?: boolean; // Flag for CEB-based responses (bypasses verification)
  cebCategory?: string; // Which CEB vertical was used
  sourceMode?: SourceMode; // Which mode was used for this message
}