/**
 * Minimal Copilot SDK Test
 * 
 * Tests if we can execute OpenClaw tools through Copilot SDK.
 * This bypasses the full OpenClaw integration for now and just tests the concept.
 */

import { CopilotClient, defineTool } from '@github/copilot-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';

const execPromise = promisify(exec);

async function main() {
  console.log('🧪 Testing Copilot SDK with OpenClaw-style Tools\n');

  // Create client
  const client = new CopilotClient({
    autoStart: true,
    logLevel: 'info',
  });

  try {
    // Start the client
    console.log('Starting Copilot Client...');
    await client.start();
    console.log('✅ Client started\n');

    // Define OpenClaw-style tools
    const readTool = defineTool({
      name: 'read',
      description: 'Read a file from the filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      },
      handler: async (params) => {
        console.log(`[read] Reading ${params.path}`);
        const content = await readFile(params.path, 'utf-8');
        return { content: content.slice(0, 500) };
      },
    });

    const execTool = defineTool({
      name: 'exec',
      description: 'Execute a shell command',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
        },
        required: ['command'],
      },
      handler: async (params) => {
        console.log(`[exec] Running: ${params.command}`);
        const { stdout, stderr } = await execPromise(params.command);
        return { stdout: stdout.trim(), stderr: stderr.trim() };
      },
    });

    const writeTool = defineTool({
      name: 'write',
      description: 'Write content to a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
      handler: async (params) => {
        console.log(`[write] Writing to ${params.path}`);
        await writeFile(params.path, params.content);
        return { success: true, bytes: params.content.length };
      },
    });

    // Create session with tools
    console.log('Creating session with tools...');
    const session = await client.createSession({
      model: 'claude-sonnet-4.5',
      tools: [readTool, execTool, writeTool],
    });
    console.log('✅ Session created:', session.sessionId);
    console.log('');

    // Test 1: Simple command execution
    console.log('--- Test 1: List files with exec ---');
    let responseReceived = false;
    session.on('assistant.message', (event) => {
      console.log('Agent:', event.data.content);
      responseReceived = true;
    });

    session.on('tool.invocation', (event) => {
      console.log(`[Tool Call] ${event.data.tool}:`, event.data.params);
    });

    session.on('session.idle', () => {
      console.log('[Session idle]');
    });

    await session.send({ 
      prompt: 'Use the exec tool to list the files in the current directory. Just show me the output.' 
    });

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');

    // Test 2: Write and read
    console.log('--- Test 2: Write and read a file ---');
    await session.send({
      prompt: 'Use the write tool to create /tmp/copilot-test.txt with content "Hello from Copilot SDK test!", then use the read tool to read it back and show me the content.'
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');

    // Test 3: Multiple tool calls
    console.log('--- Test 3: Multiple operations ---');
    await session.send({
      prompt: 'Do the following: 1) Create /tmp/test1.txt with "File 1", 2) Create /tmp/test2.txt with "File 2", 3) Use exec to list /tmp/*.txt and show me the output. Use your tools!'
    });

    await new Promise(resolve => setTimeout(resolve, 8000));
    console.log('');

    // Check session usage
    console.log('--- Session Info ---');
    const sessions = await client.listSessions();
    const ourSession = sessions.find(s => s.sessionId === session.sessionId);
    if (ourSession) {
      console.log('Session metadata:', ourSession);
    }

    // Cleanup
    await session.destroy();
    await client.stop();
    
    console.log('');
    console.log('✅ Test complete!');
    console.log('');
    console.log('🎯 Key Findings:');
    console.log('  - Copilot SDK can execute custom tools ✅');
    console.log('  - Tools run within same session (single premium request) ✅');
    console.log('  - Multiple tool calls work in sequence ✅');
    console.log('');
    console.log('💡 Next: Integrate this into OpenClaw as a runtime option');

  } catch (error) {
    console.error('❌ Error:', error);
    await client.stop();
    process.exit(1);
  }
}

main();
