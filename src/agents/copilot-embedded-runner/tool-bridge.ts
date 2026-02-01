/**
 * Tool Execution Bridge: Copilot SDK ↔ OpenClaw
 * 
 * This module bridges Copilot SDK tool calls back to OpenClaw's tool execution system.
 * Key insight: OpenClaw tools have an execute() method that takes (callId, params).
 */

import type { AnyAgentTool } from '../tools/common.js';
import type { AgentRunContext } from '../agent-types.js';
import { createSubsystemLogger } from '../../logging/subsystem.js';

const log = createSubsystemLogger('copilot-bridge');

/**
 * Execute an OpenClaw tool from a Copilot SDK tool call
 */
export async function executeOpenClawTool(
  toolName: string,
  params: any,
  context: AgentRunContext
): Promise<any> {
  const { tools, sessionKey } = context;
  
  if (!tools || tools.length === 0) {
    log.error(`No tools available in context`);
    return {
      status: 'error',
      error: 'No tools available',
    };
  }

  // Find the tool by name
  const tool = tools.find((t) => t.name === toolName);
  
  if (!tool) {
    log.error(`Tool not found: ${toolName}`);
    return {
      status: 'error',
      error: `Tool not found: ${toolName}`,
    };
  }

  try {
    log.info(`Executing tool: ${toolName} (session: ${sessionKey})`);
    
    // Generate a unique call ID for this tool execution
    const callId = `copilot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Execute the tool using OpenClaw's standard tool.execute() interface
    const result = await tool.execute(callId, params);
    
    log.info(`Tool executed successfully: ${toolName}`);
    return result;
    
  } catch (error) {
    log.error(`Tool execution failed: ${toolName}`, error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert OpenClaw tools to Copilot SDK tool format
 */
export function convertToolsToCopilotFormat(
  openClawTools: AnyAgentTool[],
  context: AgentRunContext
): Array<{
  name: string;
  description: string;
  parameters: any;
  function: (params: any) => Promise<any>;
}> {
  return openClawTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
    function: async (params: any) => {
      return await executeOpenClawTool(tool.name, params, context);
    },
  }));
}

/**
 * Extract tool result as text for streaming back to user
 */
export function extractToolResultText(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return String(result);
  }

  const record = result as Record<string, unknown>;

  // Handle structured tool results with content array
  if (Array.isArray(record.content)) {
    const texts = record.content
      .map((item: any) => {
        if (item && typeof item === 'object' && item.type === 'text') {
          return item.text;
        }
        return undefined;
      })
      .filter(Boolean);
    
    if (texts.length > 0) {
      return texts.join('\n');
    }
  }

  // Handle simple text result
  if (typeof record.result === 'string') {
    return record.result;
  }

  // Handle output field
  if (typeof record.output === 'string') {
    return record.output;
  }

  // Fallback: JSON stringify
  return JSON.stringify(result, null, 2);
}

/**
 * Check if a tool result indicates an error
 */
export function isToolResultError(result: unknown): boolean {
  if (!result || typeof result !== 'object') {
    return false;
  }

  const record = result as Record<string, unknown>;
  
  if (record.status === 'error') {
    return true;
  }

  if (record.error) {
    return true;
  }

  return false;
}
