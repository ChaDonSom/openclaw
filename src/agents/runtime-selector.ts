// @ts-nocheck
/**
 * Agent Runtime Selector
 * 
 * Allows switching between Pi and Copilot SDK runtimes via config.
 */

import type { AgentRunContext, AgentRunResult } from './agent-types.js';
import { runEmbeddedPiAgent } from './pi-embedded-runner/run.js';
import { runCopilotAgent } from './copilot-embedded-runner/run.js';

export type AgentRuntime = 'pi' | 'copilot';

interface RuntimeConfig {
  runtime: AgentRuntime;
  // Copilot-specific settings
  copilot?: {
    model?: string;
    allowAll?: boolean;
    maxTurns?: number;
  };
}

/**
 * Run an agent using the configured runtime
 * 
 * NOTE: Currently disabled - Pi and Copilot have different interfaces.
 * Use runCopilotAgent() or runEmbeddedPiAgent() directly for now.
 */
export async function runAgent(
  context: any,
  config: RuntimeConfig
): Promise<any> {
  // TODO: Fix type mismatch between Pi and Copilot interfaces
  throw new Error('Runtime selector not yet implemented - use runCopilotAgent() or runEmbeddedPiAgent() directly');
  
  // switch (config.runtime) {
  //   case 'copilot':
  //     console.log('[Runtime] Using Copilot SDK');
  //     return await runCopilotAgent(context, config.copilot);
  //   
  //   case 'pi':
  //   default:
  //     console.log('[Runtime] Using Pi (legacy)');
  //     return await runEmbeddedPiAgent(context);
  // }
}

/**
 * Get the runtime from environment or config
 */
export function resolveRuntime(): AgentRuntime {
  const env = process.env.OPENCLAW_AGENT_RUNTIME;
  if (env === 'copilot') return 'copilot';
  if (env === 'pi') return 'pi';
  
  // Default to Pi for backward compatibility
  return 'pi';
}
