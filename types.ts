export enum MessageRole {
  USER = 'user',
  BOT = 'bot',
}

export interface Source {
  title: string;
  url: string;
  id?: string; // For citation mapping [id]
  excerpt?: string; // Source excerpt for verification
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

export type VerificationStatus = 'verified' | 'partially_verified' | 'refusal' | 'unverified';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  sources?: Source[];
  verificationStatus?: VerificationStatus;
  verificationReport?: VerificationReport;
  claims?: Claim[]; // Extracted claims for verification
}