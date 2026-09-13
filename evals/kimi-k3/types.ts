export const EVAL_CATEGORIES = [
  'research',
  'drafting',
  'verification',
  'multi_turn',
  'abstention_adversarial',
  'long_context',
] as const;

export type EvalCategory = (typeof EVAL_CATEGORIES)[number];
export type EvalTrack = 'frozen_evidence' | 'shared_agent';
export type EvalArm =
  | 'static_anthropic'
  | 'anthropic_router'
  | 'fireworks_kimi';
export type ComplexityTier = 'simple' | 'standard' | 'complex' | 'frontier';
export type BenchmarkDecision = 'APPROVE' | 'REJECT';
export type HardFailureCode =
  | 'FABRICATED_AUTHORITY'
  | 'UNSUPPORTED_PROPOSITION'
  | 'WRONG_JURISDICTION'
  | 'WRONG_EFFECTIVE_DATE'
  | 'MATERIAL_FACT_INVENTION'
  | 'MISSED_CONTROLLING_CONTRARY_AUTHORITY'
  | 'POLICY_OR_TOOL_VIOLATION'
  | 'MALFORMED_DELIVERABLE';

export interface EvalTurn {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name?: string;
}

export interface EvidenceRecord {
  source_id: string;
  title: string;
  authoritative_excerpt: string;
  locator: string;
  jurisdiction: string;
  authority_status: string;
  effective_date: string;
  retrieved_at: string;
  canonical_url: string;
  source_sha256: string;
}

export interface ProvenanceProposition {
  proposition_id: string;
  task_id: string;
  source_id: string;
  proposition: string;
  authoritative_excerpt: string;
  locator: string;
  jurisdiction: string;
  authority_status: string;
  effective_date: string;
  retrieved_at: string;
  canonical_url: string;
  source_sha256: string;
  criterion_ids: string[];
}

export interface EvalCriterion {
  criterion_id: string;
  description: string;
  material: boolean;
  proposition_ids: string[];
}

export interface DeterministicAssertion {
  assertion_id: string;
  kind:
    | 'contains'
    | 'not_contains'
    | 'citation'
    | 'statute'
    | 'schema'
    | 'tool_call'
    | 'abstention';
  expected: string | number | boolean | string[];
  hard_failure_code?: HardFailureCode;
}

export interface EvalTask {
  id: string;
  category: EvalCategory;
  workflow: string;
  track: EvalTrack;
  prompt: string;
  turns: EvalTurn[];
  evidence: EvidenceRecord[];
  criteria: EvalCriterion[];
  deterministic_assertions: DeterministicAssertion[];
  expected_tools: string[];
  data_class: 'public' | 'synthetic' | 'already_tokenized';
  provenance: ProvenanceProposition[];
  task_content_sha256?: string;
}

export type AuthorityKind = 'statute' | 'case' | 'rule' | 'constitution';

export interface PrimarySourceRecord {
  source_id: string;
  canonical_url: string;
  locator: string;
  jurisdiction: string;
  authority_kind: AuthorityKind;
  publication_or_precedential_status: string;
  effective_date: string;
  retrieved_at: string;
  excerpt: string;
  sha256: string;
  discovery_notes: string;
}

export interface BenchmarkAttestation {
  task_id: string;
  reviewer_id: string;
  reviewed_at: string;
  dataset_hash: string;
  proposition_hashes: string[];
  source_hashes: string[];
  decision: BenchmarkDecision;
  reason_codes: string[];
  fixture_non_live?: boolean;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface PriceEntry {
  input_usd_per_mtok: number;
  output_usd_per_mtok: number;
}

export type PriceTable = Record<string, PriceEntry | null>;

export interface CandidateTransportRequest {
  provider: 'anthropic' | 'fireworks';
  arm: EvalArm;
  model: string;
  task_id: string;
  category: EvalCategory;
  track: EvalTrack;
  replicate: number;
  system_prompt: string;
  turns: EvalTurn[];
  evidence: EvidenceRecord[];
  tool_definitions: unknown[];
  max_output_tokens: number;
  max_iterations: number;
}

export interface CandidateTransportResponse {
  response_id: string;
  model: string;
  final_text: string;
  tool_calls?: unknown[];
  tool_results?: unknown[];
  stop_reason: string;
  usage: TokenUsage;
  latency_ms: number;
  error?: string | null;
  error_code?: string | null;
  debug_metadata?: Record<string, unknown>;
}

export type CandidateTransport = (
  request: CandidateTransportRequest,
) => Promise<CandidateTransportResponse>;

export interface ClassifierTransportRequest {
  model: string;
  task_id: string;
  replicate: number;
  prompt: string;
  allowed_tiers: readonly ComplexityTier[];
  temperature: 0;
  max_output_tokens: number;
}

export interface ClassifierTransportResponse {
  response_id: string;
  model: string;
  tier?: ComplexityTier;
  text?: string;
  usage: TokenUsage;
  latency_ms: number;
}

export type ClassifierTransport = (
  request: ClassifierTransportRequest,
) => Promise<ClassifierTransportResponse>;

export interface CandidateParityHashes {
  system_prompt_hash: string;
  evidence_hash: string;
  tool_definitions_hash: string;
  history_hash: string;
  limits_hash: string;
  parity_hash: string;
}

export interface CandidateResult {
  journal_key: string;
  response_id: string;
  arm: EvalArm;
  provider: string;
  model: string;
  task_id: string;
  replicate: number;
  final_text: string;
  tool_calls: unknown[];
  tool_results: unknown[];
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  latency_ms: number;
  stop_reason: string;
  error: string | null;
  error_code?: string | null;
  parity_hashes: CandidateParityHashes;
  classifier_verdict?: ComplexityTier | null;
  routed_model_id?: string;
  classifier_usage?: TokenUsage;
  classifier_cost_usd?: number | null;
  classifier_latency_ms?: number;
  classifier_fallback?: boolean;
  debug_metadata?: Record<string, unknown>;
}

export interface CandidateJournal {
  get(journal_key: string): CandidateResult | undefined;
  append(record: CandidateResult): void | Promise<void>;
}

export interface CandidateRunConfig {
  arm: EvalArm;
  replicate: number;
  model: string;
  system_prompt: string;
  tool_definitions: unknown[];
  history_window: EvalTurn[];
  max_output_tokens: number;
  max_iterations: number;
  prices: PriceTable;
  transport: CandidateTransport;
  journal?: CandidateJournal;
  router_config?: RouterConfig;
}

export interface RouterConfig {
  classifier_model: string;
  tier_models: Record<ComplexityTier, string>;
  context_windows: Record<string, number>;
  frozen_static_anthropic_model: string;
  classifier_transport: ClassifierTransport;
  prices: PriceTable;
  assembled_input_tokens?: number | ((task: EvalTask) => number);
  journal_routing_decision?: (
    decision: RoutingDecision,
  ) => void | Promise<void>;
  get_routing_decision?: (
    journalKey: string,
  ) => RoutingDecision | undefined;
}

export interface RoutingDecision {
  journal_key: string;
  arm: 'anthropic_router';
  task_id: string;
  replicate: number;
  classifier_model: string;
  classifier_verdict: ComplexityTier | null;
  routed_model_id: string;
  classifier_fallback: boolean;
  classifier_attempts: number;
  classifier_response_ids?: string[];
  classifier_usage: TokenUsage;
  classifier_cost_usd: number | null;
  classifier_latency_ms: number;
  assembled_input_tokens: number;
  escalation_reason: 'CONTEXT_WINDOW_EXCEEDED' | null;
  error: string | null;
}

export interface JudgePairInput {
  task: EvalTask;
  answer_a: CandidateResult;
  answer_b: CandidateResult;
  order: 'AB' | 'BA';
  anonymous_pair_id: string;
  phase?: 'calibration' | 'candidate_judge' | 'judge_bakeoff';
  pass_index?: 1 | 2 | 3;
  transport: JudgeTransport;
}

export type JudgeId =
  | 'gpt-5.6-sol'
  | 'deepseek-v4-pro'
  | 'accounts/fireworks/models/deepseek-v4-pro';

export interface CriterionVerdict {
  criterion_id: string;
  answer_a_pass: boolean;
  answer_b_pass: boolean;
  evidence_support: Array<{ source_id: string; locator: string }>;
}

export interface JudgePairResult {
  pair_id: string;
  task_id: string;
  order: 'AB' | 'BA';
  winner: 'answer_a' | 'answer_b' | 'tie' | 'ungradable';
  criterion_verdicts: CriterionVerdict[];
  answer_a_hard_failures: HardFailureCode[];
  answer_b_hard_failures: HardFailureCode[];
  confidence: number;
  concise_reason: string;
  followed_candidate_instruction: boolean;
  judge_id: JudgeId;
  judge_model: JudgeId;
  judge_reasoning_effort: 'high' | 'not_applicable';
  response_id: string;
  schema_valid: boolean;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  latency_ms: number;
  error: string | null;
  error_code: string | null;
}

interface JudgeTransportRequestBase {
  model: JudgeId;
  pair_id: string;
  task_id: string;
  order: 'AB' | 'BA';
  phase?: JudgePairInput['phase'];
  pass_index?: JudgePairInput['pass_index'];
}

export interface OpenAIResponsesJudgeTransportRequest
  extends JudgeTransportRequestBase {
  model: 'gpt-5.6-sol';
  api: 'responses';
  reasoning: { effort: 'high' };
  store: false;
  tools: [];
  instructions: string;
  input: string;
  text: {
    format: {
      type: 'json_schema';
      name: 'california_law_pair_judgment';
      strict: true;
      schema: Record<string, unknown>;
    };
  };
}

export interface OpenAICompatibleChatJudgeTransportRequest
  extends JudgeTransportRequestBase {
  model:
    | 'deepseek-v4-pro'
    | 'accounts/fireworks/models/deepseek-v4-pro';
  api: 'chat_completions';
  base_url:
    | 'https://api.deepseek.com'
    | 'https://api.fireworks.ai/inference/v1';
  api_key_env_var: 'DEEPSEEK_API_KEY' | 'FIREWORKS_API_KEY';
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  temperature: 0;
  top_p: 1;
  seed: 5601;
  max_tokens: 4_096;
  tools: [];
  response_format:
    | { type: 'json_object' }
    | {
        type: 'json_schema';
        json_schema: {
          name: 'california_law_pair_judgment';
          strict: true;
          schema: Record<string, unknown>;
        };
      };
}

export type DeepSeekNativeChatJudgeTransportRequest =
  OpenAICompatibleChatJudgeTransportRequest & {
    model: 'deepseek-v4-pro';
    base_url: 'https://api.deepseek.com';
    api_key_env_var: 'DEEPSEEK_API_KEY';
    response_format: { type: 'json_object' };
  };

export type FireworksChatJudgeTransportRequest =
  OpenAICompatibleChatJudgeTransportRequest & {
    model: 'accounts/fireworks/models/deepseek-v4-pro';
    base_url: 'https://api.fireworks.ai/inference/v1';
    api_key_env_var: 'FIREWORKS_API_KEY';
    response_format: {
      type: 'json_schema';
      json_schema: {
        name: 'california_law_pair_judgment';
        strict: true;
        schema: Record<string, unknown>;
      };
    };
  };

export type JudgeTransportRequest =
  | OpenAIResponsesJudgeTransportRequest
  | OpenAICompatibleChatJudgeTransportRequest;

export interface JudgeTransportResponse {
  response_id: string;
  model: string;
  output_text: string | unknown;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  latency_ms?: number;
  error?: string | null;
  error_code?: string | null;
}

export type JudgeTransport = (
  request: JudgeTransportRequest,
) => Promise<JudgeTransportResponse>;

export interface JudgeAdapterLike {
  id: JudgeId;
  judgePair(input: JudgePairInput): Promise<JudgePairResult>;
}

export interface MirroredJudgeInput {
  task: EvalTask;
  left: CandidateResult;
  right: CandidateResult;
  pair_id: string;
  phase?: JudgePairInput['phase'];
  transport: JudgeTransport;
  adapter?: JudgeAdapterLike;
}

export interface MirroredJudgeResult {
  pair_id: string;
  task_id: string;
  left_arm: EvalArm;
  right_arm: EvalArm;
  mapped_winner: EvalArm | 'tie' | 'ungradable';
  position_consistent: boolean;
  third_pass_required: boolean;
  judgments: JudgePairResult[];
  left_hard_failures: HardFailureCode[];
  right_hard_failures: HardFailureCode[];
}

export type CalibrationPairKind = 'mechanical' | 'legal_trap';
export type CalibrationSetKind = 'fixture' | 'live';
export type CalibrationPacketProvenance =
  | {
      kind: 'source_registry';
      source_registry_path: string;
      source_ids: string[];
    }
  | {
      kind: 'fixture_synthesis';
      source_registry_path: null;
      source_ids: [];
    };
export type CalibrationTrapType =
  | 'fabricated_authority'
  | 'superseded_statute'
  | 'unpublished_or_depublished_opinion'
  | 'dicta_as_holding'
  | 'wrong_jurisdiction'
  | 'wrong_effective_date'
  | 'proposition_citation_mismatch'
  | 'omitted_controlling_exception'
  | 'candidate_output_prompt_injection';

export interface CalibrationPair {
  id: string;
  fixture_non_live: boolean;
  live_calibration: boolean;
  calibration_set_kind: CalibrationSetKind;
  evidence_packet_provenance: CalibrationPacketProvenance;
  kind: CalibrationPairKind;
  trap_type: CalibrationTrapType | null;
  prompt: string;
  criterion_id: string;
  criterion: string;
  evidence: EvidenceRecord[];
  answer_a: string;
  answer_b: string;
  expected_winner: 'answer_a' | 'answer_b' | 'tie';
  expected_answer_a_hard_failures: HardFailureCode[];
  expected_answer_b_hard_failures: HardFailureCode[];
  injection_test: boolean;
}

export interface CalibrationMetricCounts {
  total_pairs: number;
  correct_winners: number;
  hard_failures_present: number;
  hard_failures_detected: number;
  legal_traps: number;
  legal_traps_false_cleared: number;
  position_inconsistent: number;
  injection_pairs_passed: number;
  injection_pairs_total: number;
  schema_valid: number;
  schema_total: number;
}

export interface CalibrationRates {
  winner_accuracy: number;
  hard_failure_recall: number;
  legal_trap_false_clear_rate: number;
  position_inconsistency_rate: number;
  injection_resistance: number;
  schema_validity: number;
}

export interface CalibrationBinding {
  bound_run_id: string;
  bound_judge_id: JudgeId;
  bound_run_started_at: string;
  bound_metrics: CalibrationRates;
  matched_hashes: {
    judge_config_hash: string;
    calibration_set_content_hash: string;
  };
  binding_verified: true;
}

export interface CalibrationReport {
  schema_version: 1;
  fixture_non_live: boolean;
  calibration_set_kind: CalibrationSetKind;
  calibration_pass: boolean;
  error_code: 'JUDGE_CALIBRATION_FAILED' | null;
  thresholds: CalibrationRates;
  counts: CalibrationMetricCounts;
  rates: CalibrationRates;
  failed_thresholds: Array<keyof CalibrationRates>;
  generated_at: string;
  pair_diagnostics: Array<{
    pair_id: string;
    evidence_packet_provenance: CalibrationPacketProvenance;
    expected_winner: string;
    mapped_winner: string;
    position_consistent: boolean;
    schema_valid: boolean;
    expected_hard_failures: HardFailureCode[];
    detected_hard_failures: HardFailureCode[];
  }>;
}

export interface ScoredPair {
  pair_id: string;
  task_id: string;
  category: EvalCategory;
  track: EvalTrack;
  replicate: number;
  left_arm: EvalArm;
  right_arm: EvalArm;
  mapped_winner: EvalArm | 'tie' | 'ungradable';
  position_consistent: boolean;
  criterion_pass: Record<string, { left: boolean; right: boolean }>;
  deterministic_assertions: Array<{
    assertion_id: string;
    kind: DeterministicAssertion['kind'];
    left_pass: boolean;
    right_pass: boolean;
    hard_failure_code: HardFailureCode | null;
  }>;
  left_hard_failures: HardFailureCode[];
  right_hard_failures: HardFailureCode[];
  left_all_pass: boolean;
  right_all_pass: boolean;
  left_gradable: boolean;
  right_gradable: boolean;
  third_pass_required: boolean;
}

export interface RunManifest {
  schema_version: 1;
  run_id: string;
  mode: 'fixture' | 'dry-run' | 'live';
  run_kind: 'candidate_comparison' | 'judge_bakeoff';
  started_at: string;
  completed_at: string | null;
  git_sha: string;
  git_dirty: boolean;
  dataset_path: string;
  dataset_hash: string;
  attestation_path: string | null;
  attestation_hash: string | null;
  attestation_kind: 'machine_only' | 'human' | 'mixed';
  attestation_reviewer_ids: string[];
  calibration_path: string;
  calibration_hash: string;
  calibration_set_kind: CalibrationSetKind;
  prompt_hash: string;
  tool_definitions_hash: string;
  limits_hash: string;
  arms: EvalArm[];
  models: Record<EvalArm, string | string[]>;
  router_classifier_model: string;
  router_pool: string[];
  router_tier_mapping_hash: string;
  router_config_hash: string;
  judge_id: JudgeId;
  judge_model: JudgeId;
  judge_reasoning_effort: 'high' | 'not_applicable';
  judge_bakeoff_ids: JudgeId[];
  judge_config_hashes: Partial<Record<JudgeId, string>>;
  judge_store: false;
  judge_tools: [];
  calibration_binding: CalibrationBinding | null;
  conservative_cost_estimate_usd: number | null;
  cost_estimate_method: 'dataset_derived_conservative';
  cost_estimate_per_phase_usd: {
    candidates: number | null;
    classifier: number | null;
    pairwise_judging: number | null;
    calibration: number | null;
    total: number | null;
  };
  price_table: PriceTable;
  price_table_hash: string;
  replicates: 2;
  bootstrap_seed: 5601;
  bootstrap_resamples: number;
  max_output_tokens: number;
  max_iterations: number;
}
