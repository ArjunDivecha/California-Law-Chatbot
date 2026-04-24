import { existsSync } from 'fs';
import { homedir } from 'os';
import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateTextOptions {
  model: string;
  messages: LLMMessage[];
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
  responseMimeType?: string;
}

export type ProviderMode = 'bedrock';

interface BedrockProviderConfig {
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsSessionToken?: string;
  awsRegion: string;
  bearerToken?: string;
}

type BedrockMessageParam = {
  role: 'user' | 'assistant';
  content: string;
};

type BedrockTextBlock = {
  type: 'text';
  text: string;
};

type BedrockMessageResponse = {
  content: Array<BedrockTextBlock | { type: string; [key: string]: unknown }>;
};

let cachedClient: AnthropicBedrock | null = null;
let cachedConfigSignature: string | null = null;

function hasSharedAwsCredentialsFile(): boolean {
  const credentialsPath = process.env.AWS_SHARED_CREDENTIALS_FILE || `${homedir()}/.aws/credentials`;
  const configPath = process.env.AWS_CONFIG_FILE || `${homedir()}/.aws/config`;
  return existsSync(credentialsPath) || existsSync(configPath);
}

export function resolveBedrockProviderConfig(): BedrockProviderConfig {
  return {
    awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsSessionToken: process.env.AWS_SESSION_TOKEN,
    awsRegion:
      process.env.BEDROCK_AWS_REGION ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      'us-west-2',
    bearerToken: process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.BEDROCK_API_KEY,
  };
}

export function hasBedrockProviderCredentials(): boolean {
  const hasStaticKeys = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
  const hasProfileHints =
    !!process.env.AWS_PROFILE ||
    !!process.env.AWS_ROLE_ARN ||
    !!process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
    !!process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    !!process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;

  return (
    !!process.env.AWS_BEARER_TOKEN_BEDROCK ||
    !!process.env.BEDROCK_API_KEY ||
    hasStaticKeys ||
    hasProfileHints ||
    hasSharedAwsCredentialsFile()
  );
}

export function getBedrockProviderMode(): ProviderMode {
  return 'bedrock';
}

export function getAnthropicBedrockClient(): AnthropicBedrock {
  const config = resolveBedrockProviderConfig();
  const signature = JSON.stringify(config);

  if (cachedClient && cachedConfigSignature === signature) {
    return cachedClient;
  }

  cachedClient = new AnthropicBedrock({
    apiKey: config.bearerToken,
    awsAccessKey: config.awsAccessKey,
    awsSecretKey: config.awsSecretKey,
    awsSessionToken: config.awsSessionToken,
    awsRegion: config.awsRegion,
  });

  cachedConfigSignature = signature;
  return cachedClient;
}

export function buildMessagesFromConversation(
  conversationHistory: Array<{ role?: string; text?: string }> | undefined,
  message: string
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  if (Array.isArray(conversationHistory)) {
    const recentHistory = conversationHistory.slice(-10);
    for (const entry of recentHistory) {
      if (entry?.role && entry?.text) {
        messages.push({
          role: entry.role === 'user' ? 'user' : 'assistant',
          content: entry.text,
        });
      }
    }
  }

  messages.push({
    role: 'user',
    content: message.trim(),
  });

  return messages;
}

export function buildBedrockMessages(messages: LLMMessage[]): BedrockMessageParam[] {
  return messages
    .filter((message) => typeof message.content === 'string' && message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export function extractResponseText(response: BedrockMessageResponse): string {
  return response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
}

export async function generateText(options: GenerateTextOptions): Promise<{
  text: string;
  response: BedrockMessageResponse;
  providerMode: ProviderMode;
}> {
  const client = getAnthropicBedrockClient();
  const response = await client.messages.create(
    {
      model: options.model,
      system: options.systemInstruction,
      messages: buildBedrockMessages(options.messages),
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxOutputTokens || 4096,
    },
    {
      signal: options.abortSignal,
    }
  );

  const typedResponse = response as BedrockMessageResponse;
  const text = extractResponseText(typedResponse);
  if (!text) {
    throw new Error('No text content in Anthropic Bedrock response');
  }

  return {
    text,
    response: typedResponse,
    providerMode: 'bedrock',
  };
}

export async function generateTextStream(options: GenerateTextOptions): Promise<{
  stream: AsyncIterable<any>;
  providerMode: ProviderMode;
}> {
  const client = getAnthropicBedrockClient();
  const stream = client.messages.stream(
    {
      model: options.model,
      system: options.systemInstruction,
      messages: buildBedrockMessages(options.messages),
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxOutputTokens || 4096,
    },
    {
      signal: options.abortSignal,
    }
  );

  return {
    stream,
    providerMode: 'bedrock',
  };
}

export function getErrorDetails(error: unknown): { message: string; status?: number } {
  const maybeError = error as { message?: string; status?: number; code?: number | string };
  const message = maybeError?.message || String(error);
  const rawStatus = maybeError?.status ?? maybeError?.code;
  const numericStatus =
    typeof rawStatus === 'number'
      ? rawStatus
      : typeof rawStatus === 'string' && /^\d+$/.test(rawStatus)
        ? Number(rawStatus)
        : undefined;

  return {
    message,
    status: numericStatus,
  };
}

export function isRetryableProviderError(error: unknown): boolean {
  const { message, status } = getErrorDetails(error);
  const lowerMessage = message.toLowerCase();

  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (typeof status === 'number' && status >= 500) ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('deadline') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('throttl') ||
    lowerMessage.includes('overloaded') ||
    lowerMessage.includes('unavailable')
  );
}
