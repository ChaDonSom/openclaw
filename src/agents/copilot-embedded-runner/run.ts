// @ts-nocheck
/**
 * Copilot SDK Agent Runner
 * 
 * This replaces Pi's agent runtime with GitHub Copilot SDK's agentic orchestration.
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

  const copilot = new CopilotClient({
    useStdio: false,
    port: 0,
    autoStart: true,
    autoRestart: config.autoRestart ?? true,
  });

  try {
    log.info(`Starting Copilot SDK client (session: ${sessionKey})`);
    await copilot.start();
    log.info('Copilot SDK client started');

    const copilotMessages = messages.map(msg => ({
      role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    }));

    const copilotTools = tools ? convertToolsToCopilotFormat(tools, context) : [];
    log.info(`Converted ${copilotTools.length} tools to Copilot SDK format`);

    const session = await copilot.createSession({
      model,
      tools: copilotTools,
      systemMessage: systemPrompt ? { content: systemPrompt } : undefined,
    });

    log.info(`Session created: ${session.sessionId}`);

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
        context.onToolCall(event.data.tool, event.data.params);
      }
    });

    session.on('tool.execution_start', (event: any) => {
      log.info(`Tool execution started: ${event.data.tool}`);
    });

    session.on('tool.execution_complete', (event: any) => {
      log.info(`Tool execution complete: ${event.data.tool}`);
    });

    await session.send({
      prompt: copilotMessages[copilotMessages.length - 1]?.content || '',
    });

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, config.maxTurns ? config.maxTurns * 5000 : 30000);
      session.on('session.idle', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    log.info(`Session complete. Tool calls: ${toolCallCount}`);

    await session.destroy();
    await copilot.stop();

    return {
      success: true,
      response: fullResponse,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        premiumRequests: 1,
      },
    };
  } catch (error) {
    log.error('Copilot SDK error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      await copilot.stop();
    } catch (e) {
      log.error('Error stopping Copilot client:', e);
    }
  }
}
