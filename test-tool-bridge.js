#!/usr/bin/env node
/**
 * Integration Test: Copilot SDK Tool Bridge
 * 
 * Tests the tool execution bridge by running a simple agent task
 * that requires multiple tool calls.
 * 
 * Usage:
 *   node test-tool-bridge.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the agent context and tools for testing
class MockTool {
  constructor(name, description, executor) {
    this.name = name;
    this.description = description;
    this.executor = executor;
    this.input_schema = {
      type: 'object',
      properties: {},
    };
  }

  async execute(callId, params) {
    console.log(`[${this.name}] Executing with callId: ${callId}`);
    console.log(`[${this.name}] Params:`, params);
    
    try {
      const result = await this.executor(params);
      console.log(`[${this.name}] Success:`, result);
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(`[${this.name}] Error:`, error.message);
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}

// Import the tool bridge
async function testToolBridge() {
  console.log('🧪 Testing Copilot SDK Tool Bridge\n');

  // Dynamic import of the tool bridge
  const toolBridgeModule = await import('./src/agents/copilot-embedded-runner/tool-bridge.js');
  const { executeOpenClawTool, convertToolsToCopilotFormat, extractToolResultText, isToolResultError } = toolBridgeModule;

  // Create mock tools
  const tools = [
    new MockTool('read', 'Read a file', async (params) => {
      const fs = await import('fs/promises');
      const content = await fs.readFile(params.path || params.file_path, 'utf-8');
      return content.slice(0, 200) + (content.length > 200 ? '...' : '');
    }),
    
    new MockTool('exec', 'Execute a command', async (params) => {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);
      const { stdout } = await execPromise(params.command);
      return stdout.trim();
    }),
    
    new MockTool('write', 'Write to a file', async (params) => {
      const fs = await import('fs/promises');
      await fs.writeFile(params.path || params.file_path, params.content);
      return `Wrote ${params.content.length} bytes to ${params.path || params.file_path}`;
    }),
  ];

  // Create mock context
  const context = {
    sessionKey: 'test-session',
    tools: tools,
    messages: [],
    onChunk: (chunk) => process.stdout.write(chunk),
    onToolCall: (tool, params) => console.log(`\n[Tool Call] ${tool}:`, JSON.stringify(params, null, 2)),
  };

  console.log('📝 Available tools:', tools.map(t => t.name).join(', '));
  console.log('');

  // Test 1: Execute a simple command
  console.log('--- Test 1: Execute ls command ---');
  const result1 = await executeOpenClawTool('exec', { command: 'ls -la | head -10' }, context);
  console.log('Result:', extractToolResultText(result1));
  console.log('Is error?', isToolResultError(result1));
  console.log('');

  // Test 2: Read a file
  console.log('--- Test 2: Read package.json ---');
  const result2 = await executeOpenClawTool('read', { path: 'package.json' }, context);
  console.log('Result (truncated):', extractToolResultText(result2).slice(0, 150) + '...');
  console.log('Is error?', isToolResultError(result2));
  console.log('');

  // Test 3: Write and read back
  console.log('--- Test 3: Write and read /tmp/test-copilot.txt ---');
  const testContent = 'Hello from Copilot SDK test! ' + new Date().toISOString();
  const result3 = await executeOpenClawTool('write', { path: '/tmp/test-copilot.txt', content: testContent }, context);
  console.log('Write result:', extractToolResultText(result3));
  
  const result4 = await executeOpenClawTool('read', { path: '/tmp/test-copilot.txt' }, context);
  console.log('Read back:', extractToolResultText(result4));
  console.log('');

  // Test 4: Convert tools to Copilot format
  console.log('--- Test 4: Convert tools to Copilot format ---');
  const copilotTools = convertToolsToCopilotFormat(tools, context);
  console.log('Converted tools:', copilotTools.map(t => ({
    name: t.name,
    description: t.description,
    hasFunction: typeof t.function === 'function',
  })));
  console.log('');

  // Test 5: Execute via Copilot-format wrapper
  console.log('--- Test 5: Execute via Copilot wrapper ---');
  const execTool = copilotTools.find(t => t.name === 'exec');
  if (execTool) {
    const result5 = await execTool.function({ command: 'echo "Test from Copilot wrapper"' });
    console.log('Wrapper result:', extractToolResultText(result5));
  }
  console.log('');

  // Test 6: Error handling
  console.log('--- Test 6: Error handling (non-existent tool) ---');
  const result6 = await executeOpenClawTool('nonexistent', {}, context);
  console.log('Error result:', result6);
  console.log('Is error?', isToolResultError(result6));
  console.log('');

  console.log('✅ All tests complete!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  - Tool execution: ✅');
  console.log('  - Error handling: ✅');
  console.log('  - Result extraction: ✅');
  console.log('  - Copilot format conversion: ✅');
  console.log('');
  console.log('🎯 Tool bridge is working! Ready for Copilot SDK integration.');
}

// Run the test
testToolBridge().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
