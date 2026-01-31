/**
 * Shared type definitions for agent runtimes
 */

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface AgentRunContext {
  sessionKey: string;
  messages: AgentMessage[];
  tools?: AgentTool[];
  systemPrompt?: string;
  model?: string;
  onChunk?: (chunk: string) => void;
  onToolCall?: (tool: string, params: any) => void;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  premiumRequests: number;
}

export interface AgentRunResult {
  success: boolean;
  response?: string;
  error?: string;
  usage?: AgentUsage;
}
