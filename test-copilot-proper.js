/**
 * Copilot SDK Tool Execution Test (Proper Waiting)
 *
 * Tests if Copilot SDK can execute OpenClaw-style tools with proper event handling.
 */

import { CopilotClient, defineTool } from '@github/copilot-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';

const execPromise = promisify(exec);

async function waitForIdle(session, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for session to become idle'));
    }, timeoutMs);

    const handler = () => {
      clearTimeout(timeout);
      session.off('session.idle', handler);
      resolve();
    };

    session.on('session.idle', handler);
  });
}

async function main() {
  console.log('🧪 Copilot SDK Tool Execution Test\n');

  const client = new CopilotClient({ autoStart: true });

  try {
    await client.start();
    console.log('✅ Client started\n');

    // Define tools
    const execTool = defineTool({
      name: 'exec',
      description: 'Execute a shell command and return stdout',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['command'],
      },
      handler: async (params) => {
        console.log(`\n[exec] Executing: ${params.command}`);
        try {
          const { stdout, stderr } = await execPromise(params.command, { timeout: 10000 });
          const result = stdout.trim() || stderr.trim();
          console.log(`[exec] Result: ${result.slice(0, 200)}...`);
          return result;
        } catch (error) {
          console.error(`[exec] Error:`, error.message);
          throw error;
        }
      },
    });

    const writeTool = defineTool({
      name: 'write',
      description: 'Write content to a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
      handler: async (params) => {
        console.log(`\n[write] Writing ${params.content.length} bytes to ${params.path}`);
        await writeFile(params.path, params.content);
        console.log(`[write] Success`);
        return `Wrote ${params.content.length} bytes to ${params.path}`;
      },
    });

    const readTool = defineTool({
      name: 'read',
      description: 'Read a file and return its content',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      handler: async (params) => {
        console.log(`\n[read] Reading ${params.path}`);
        const content = await readFile(params.path, 'utf-8');
        console.log(`[read] Read ${content.length} bytes`);
        return content;
      },
    });

    // Create session
    const session = await client.createSession({
      model: 'claude-sonnet-4.5',
      tools: [execTool, writeTool, readTool],
    });

    console.log(`Session: ${session.sessionId}\n`);

    // Set up event handlers
    session.on('assistant.message', (event) => {
      console.log(`\n[Agent] ${event.data.content}\n`);
    });

    session.on('tool.invocation', (event) => {
      console.log(`[Tool Called] ${event.data.tool} with params:`, JSON.stringify(event.data.params, null, 2));
    });

    // Test: Execute a simple command
    console.log('=== Test: List current directory ===\n');
    await session.send({ 
      prompt: 'Execute the command "ls -la | head -20" using the exec tool. Show me the result.'
    });
    
    await waitForIdle(session, 20000);
    console.log('\n=== Test complete ===\n');

    // Cleanup
    await session.destroy();
    await client.stop();

    console.log('✅ All done!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    await client.stop();
    process.exit(1);
  }
}

main();
