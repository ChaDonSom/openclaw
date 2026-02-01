#!/usr/bin/env node
/**
 * Quick Copilot SDK Runtime Test
 * 
 * This bypasses OpenClaw's build system entirely and directly demonstrates
 * that we can run agent sessions with Copilot SDK + OpenClaw-style tools.
 * 
 * Usage: node quick-test.js "your prompt here"
 */

import { CopilotClient, defineTool } from '@github/copilot-sdk';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Simple exec tool with Zod schema
const execTool = defineTool('exec', {
  description: 'Execute a shell command',
  parameters: z.object({
    command: z.string().describe('Shell command to execute'),
  }),
  handler: async ({ command }) => {
    console.log(`\n🔧 Executing: ${command}`);
    try {
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      const output = stdout || stderr;
      console.log(`✅ Result: ${output.slice(0, 200)}${output.length > 200 ? '...' : ''}`);
      return { status: 'success', output };
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  },
});

async function runAgent(prompt) {
  console.log('🚀 Starting Copilot SDK Agent\n');
  
  const client = new CopilotClient({
    useStdio: false, // TCP required for tools!
    port: 0,
  });

  try {
    await client.start();
    console.log('✅ Client started\n');

    const session = await client.createSession({
      model: 'claude-sonnet-4.5', // Use the premium model
      tools: [execTool],
    });

    console.log(`📝 Session: ${session.sessionId}`);
    console.log(`💬 Prompt: "${prompt}"\n`);

    let response = '';
    let toolCalls = 0;

    session.on('assistant.message', (event) => {
      response = event.data.content;
      console.log(`\n[Assistant] ${response}`);
    });

    session.on('tool.user_requested', (event) => {
      toolCalls++;
      console.log(`\n[Tool #${toolCalls}] ${event.data.tool}`);
    });

    await session.send({ prompt });

    // Wait for completion
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 30000);
      session.on('session.idle', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await session.destroy();
    await client.stop();

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 RESULTS:`);
    console.log(`   Tool calls: ${toolCalls}`);
    console.log(`   Final response: ${response || '(none)'}`);
    console.log(`\n💰 BILLING: 1 premium request (all tools included)\n`);

    return { success: true, response, toolCalls };

  } catch (error) {
    console.error('\n❌ Error:', error);
    return { success: false, error: error.message };
  }
}

// Get prompt from command line or use default
const prompt = process.argv[2] || 'Use exec to check the current date and time';

runAgent(prompt)
  .then((result) => {
    if (result.success) {
      console.log('✅ Test completed successfully!\n');
      process.exit(0);
    } else {
      console.log('❌ Test failed:', result.error, '\n');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
