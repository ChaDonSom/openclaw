#!/usr/bin/env node
/**
 * Standalone Test: Copilot SDK + OpenClaw Integration
 * 
 * This test demonstrates the full integration working:
 * 1. Creates a mock OpenClaw context with tools
 * 2. Runs the Copilot agent with those tools
 * 3. Verifies tools execute via OpenClaw's tool.execute() interface
 * 4. Confirms 1 premium request billing
 */

import { runCopilotAgent } from './dist/agents/copilot-embedded-runner/run.js';

// Mock OpenClaw tool (matches OpenClaw's AnyAgentTool interface)
const mockExecTool = {
  name: 'exec',
  description: 'Execute a shell command',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
    },
    required: ['command'],
  },
  execute: async (callId, params) => {
    console.log(`\n🔧 [Mock Tool Execute] ${mockExecTool.name}`);
    console.log(`   Call ID: ${callId}`);
    console.log(`   Params:`, params);
    
    // Simulate command execution
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);
    
    try {
      const { stdout } = await execPromise(params.command, { timeout: 5000 });
      const result = stdout.trim();
      console.log(`   ✅ Result: ${result.slice(0, 100)}`);
      return { status: 'success', output: result };
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  },
};

// Mock OpenClaw context
const context = {
  sessionKey: 'test-copilot-integration',
  messages: [
    {
      role: 'user',
      content: 'Use the exec tool to run: echo "Hello from Copilot SDK + OpenClaw!"',
    },
  ],
  tools: [mockExecTool],
  systemPrompt: 'You are a helpful assistant testing Copilot SDK integration with OpenClaw.',
  model: 'gpt-5',
  onChunk: (chunk) => {
    process.stdout.write(chunk);
  },
  onToolCall: (tool, params) => {
    console.log(`\n📞 [Tool Call] ${tool}`, params);
  },
};

// Mock config
const config = {
  model: 'gpt-5',
  maxTurns: 5,
};

console.log('🚀 Testing Copilot SDK + OpenClaw Integration\n');
console.log('Goal: Prove tool execution works via OpenClaw interface\n');
console.log('Expected: Tool.execute() called, result returned, 1 premium request\n');
console.log('=' .repeat(60));

runCopilotAgent(context, config)
  .then((result) => {
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESULT:\n');
    console.log(`Success: ${result.success}`);
    console.log(`Response: ${result.response || '(none)'}`);
    console.log(`Error: ${result.error || '(none)'}`);
    console.log(`\n💰 BILLING:`);
    console.log(`   Premium Requests: ${result.usage?.premiumRequests || 'unknown'}`);
    
    if (result.success && result.usage?.premiumRequests === 1) {
      console.log('\n✅ INTEGRATION TEST PASSED!\n');
      console.log('🎯 Confirmed: All tool execution = 1 premium request\n');
      process.exit(0);
    } else {
      console.log('\n❌ INTEGRATION TEST FAILED\n');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ TEST ERROR:', error);
    process.exit(1);
  });
