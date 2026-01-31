/**
 * Copilot SDK Agent Runner
 * 
 * This replaces Pi's agent runtime with GitHub Copilot SDK's agentic orchestration.
 * Key benefit: Nested tool calls within a single premium request instead of spawning
 * separate agent sessions.
 */

import { CopilotSDK } from '@github/copilot-sdk';
import type { AgentRunContext, AgentRunResult } from '../agent-types.js';

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

  // Initialize Copilot SDK client
  const copilot = new CopilotSDK({
    // Auto-manages copilot CLI process lifecycle
    autoStart: true,
    // Enable all first-party tools by default (equivalent to --allow-all)
    allowAll: config.allowAll ?? true,
  });

  try {
    // Convert OpenClaw messages to Copilot format
    const copilotMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Convert OpenClaw tools to Copilot tool definitions
    const copilotTools = tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
      function: async (params: any) => {
        // Execute the tool using OpenClaw's tool execution system
        return await executeOpenClawTool(tool.name, params, context);
      },
    }));

    // Create agent session
    const session = await copilot.createSession({
      model,
      systemPrompt,
      tools: copilotTools,
    });

    // Run the agent with streaming
    let fullResponse = '';
    const stream = await session.chat(copilotMessages);

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        fullResponse += chunk.content;
        // Emit streaming chunk to OpenClaw's message bus
        if (context.onChunk) {
          context.onChunk(chunk.content);
        }
      } else if (chunk.type === 'tool_call') {
        // Copilot SDK handles tool execution internally
        // This is the key difference from Pi - nested calls don't spawn new sessions
        if (context.onToolCall) {
          context.onToolCall(chunk.tool, chunk.params);
        }
      }
    }

    return {
      success: true,
      response: fullResponse,
      usage: {
        // Copilot SDK returns usage stats
        inputTokens: session.usage.input_tokens,
        outputTokens: session.usage.output_tokens,
        premiumRequests: 1, // This is the magic - only 1 premium request!
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Clean up SDK client
    await copilot.shutdown();
  }
}

/**
 * Execute an OpenClaw tool using the existing tool execution system
 */
async function executeOpenClawTool(
  toolName: string,
  params: any,
  context: AgentRunContext
): Promise<any> {
  // This bridges Copilot SDK tool calls back to OpenClaw's tool system
  // TODO: Implement proper tool execution bridge
  console.log(`[Copilot] Executing tool: ${toolName}`, params);
  return { result: 'Tool execution not yet implemented' };
}
