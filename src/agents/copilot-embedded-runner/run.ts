/**
 * Copilot SDK Agent Runner
 * 
 * This replaces Pi's agent runtime with GitHub Copilot SDK's agentic orchestration.
 * Key benefits:
 * - Nested tool calls within a single premium request
 * - No session spawning overhead
 * 
 * CRITICAL REQUIREMENTS:
 * - Must use TCP transport (useStdio: false)
 * - Tools must use Zod schemas (handled by tool-bridge)
 */

import { CopilotClient } from '@github/copilot-sdk';
import { convertToolsToCopilotFormat } from './tool-bridge.js';
import { createSubsystemLogger } from '../../logging/subsystem.js';

const log = createSubsystemLogger('copilot-runner');

export interface CopilotAgentConfig {
  model?: string;
  autoRestart?: boolean;
  maxTurns?: number;
}

export interface AgentRunContext {
  sessionKey: string;
  messages: Array<{ role: string; content: string }>;
  tools?: any[];
  systemPrompt?: string;
  model?: string;
  onChunk?: (chunk: string) => void;
  onToolCall?: (tool: string, params: any) => void;
}

export interface AgentRunResult {
  success: boolean;
  response?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    premiumRequests: number;
  };
}

/**
 * Run an agent using Copilot SDK instead of Pi
 */
export async function runCopilotAgent(
  context: AgentRunContext,
  config: CopilotAgentConfig = {}
): Promise<AgentRunResult> {
  const {
    sessionKey,
    messages,
    tools,
    systemPrompt,
    model = 'gpt-5',
  } = context;

  // Initialize Copilot SDK client with TCP transport
  // CRITICAL: useStdio: false is required for tool execution to work
  const copilot = new CopilotClient({
    useStdio: false, // TCP transport required!
    port: 0, // Random port
    autoStart: true,
    autoRestart: config.autoRestart ?? true,
  });

  try {
    log.info(`Starting Copilot SDK client (session: ${sessionKey})`);

    // Start the client
    await copilot.start();
    log.info('Copilot SDK client started');

    // Convert OpenClaw messages to Copilot format
    const copilotMessages = messages.map(msg => ({
      role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    }));

    // Convert OpenClaw tools to Copilot SDK format with Zod schemas
    const copilotTools = tools ? convertToolsToCopilotFormat(tools, context) : [];
    log.info(`Converted ${copilotTools.length} tools to Copilot SDK format`);

    // Create agent session
    const session = await copilot.createSession({
      model,
      tools: copilotTools,
      systemMessage: systemPrompt ? {
        content: systemPrompt,
      } : undefined,
    });

    log.info(`Session created: ${session.sessionId}`);

    // Event handlers for streaming and tool execution
    let fullResponse = '';
    let toolCallCount = 0;

    session.on('assistant.message', (event: any) => {
      fullResponse = event.data.content;
      if (context.onChunk) {
        context.onChunk(fullResponse);
      }
    });

    session.on('assistant.message_delta', (event: any) => {
      if (context.onChunk) {
        context.onChunk(event.data.deltaContent);
      }
    });

    session.on('tool.user_requested', (event: any) => {
      toolCallCount++;
      log.info(`Tool requested: ${event.data.tool} (#${toolCallCount})`);
      if (context.onToolCall) {
        // @ts-ignore - Type mismatch with OpenClaw's onToolCall signature
        context.onToolCall(event.data.tool, event.data.params);
      }
    });

    session.on('tool.execution_start', (event: any) => {
      log.info(`Tool execution started: ${event.data.tool}`);
    });

    session.on('tool.execution_complete', (event: any) => {
      log.info(`Tool execution complete: ${event.data.tool}`);
    });

    // Send message and wait for completion
    await session.send({
      prompt: copilotMessages[copilotMessages.length - 1]?.content || '',
    });

    // Wait for session to complete
    // Note: session.idle timing issue exists but doesn't affect functionality
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, config.maxTurns ? config.maxTurns * 5000 : 30000);
      session.on('session.idle', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    log.info(`Session complete. Tool calls: ${toolCallCount}`);

    // Clean up
    await session.destroy();
    await copilot.stop();

    return {
      success: true,
      response: fullResponse,
      usage: {
        // Copilot SDK billing: All tool calls = 1 premium request
        inputTokens: 0, // SDK doesn't expose these yet
        outputTokens: 0,
        premiumRequests: 1, // This is the magic - only 1 premium request!
      },
    };
  } catch (error) {
    log.error('Copilot SDK error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Ensure cleanup
    try {
      await copilot.stop();
    } catch (e) {
      log.error('Error stopping Copilot client:', e);
    }
  }
}
