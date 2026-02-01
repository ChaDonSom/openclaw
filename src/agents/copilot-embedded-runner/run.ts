/**
 * Copilot SDK Agent Runner
 * 
 * This replaces Pi's agent runtime with GitHub Copilot SDK's agentic orchestration.
 * Key benefit: Nested tool calls within a single premium request instead of spawning
 * separate agent sessions.
 */

import { CopilotSDK } from '@github/copilot-sdk';
import type { AgentRunContext, AgentRunResult } from '../agent-types.js';
import { 
  convertToolsToCopilotFormat, 
  extractToolResultText,
  isToolResultError 
} from './tool-bridge.js';

interface CopilotAgentConfig {
  model?: string;
  tools?: string[];
  allowAll?: boolean;
  maxTurns?: number;
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
    model = 'claude-sonnet-4',
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
      role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
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

    session.on('assistant.message', (event) => {
      fullResponse = event.data.content;
      if (context.onChunk) {
        context.onChunk(fullResponse);
      }
    });

    session.on('assistant.message_delta', (event) => {
      if (context.onChunk) {
        context.onChunk(event.data.deltaContent);
      }
    });

    session.on('tool.invocation', (event) => {
      toolCallCount++;
      log.info(`Tool invoked: ${event.data.tool} (#${toolCallCount})`);
      if (context.onToolCall) {
        context.onToolCall(event.data.tool, event.data.params);
      }
    });

    session.on('tool.execution_start', (event) => {
      log.info(`Tool execution started: ${event.data.tool}`);
    });

    session.on('tool.execution_end', (event) => {
      log.info(`Tool execution ended: ${event.data.tool}`);
    });

    // Send message and wait for completion
    await session.send({
      prompt: copilotMessages[copilotMessages.length - 1]?.content || '',
    });

    // Wait for session to complete
    // Note: session.idle timing issue exists but doesn't affect functionality
    await new Promise((resolve) => {
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
