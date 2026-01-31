#!/usr/bin/env node
/**
 * Test script to verify Copilot SDK integration
 * 
 * Run with: OPENCLAW_AGENT_RUNTIME=copilot node test-copilot.js
 */

import { runAgent, resolveRuntime } from '../src/agents/runtime-selector.js';

async function testCopilotAgent() {
  console.log('🧪 Testing Copilot SDK Integration\n');

  const runtime = resolveRuntime();
  console.log(`Runtime: ${runtime}\n`);

  const context = {
    sessionKey: 'test-session',
    messages: [
      {
        role: 'user',
        content: 'List the files in the current directory and tell me how many there are.',
      },
    ],
    tools: [
      {
        name: 'exec',
        description: 'Execute a shell command',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string' },
          },
          required: ['command'],
        },
      },
    ],
    onChunk: (chunk) => {
      process.stdout.write(chunk);
    },
    onToolCall: (tool, params) => {
      console.log(`\n[Tool Call] ${tool}:`, params);
    },
  };

  try {
    const result = await runAgent(context, {
      runtime,
      copilot: {
        model: 'claude-sonnet-4',
        allowAll: true,
      },
    });

    console.log('\n\n✅ Result:', result);
    
    if (result.usage) {
      console.log('\n📊 Usage:');
      console.log(`  Input tokens: ${result.usage.inputTokens}`);
      console.log(`  Output tokens: ${result.usage.outputTokens}`);
      console.log(`  Premium requests: ${result.usage.premiumRequests} ⚡`);
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testCopilotAgent();
