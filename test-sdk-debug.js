/**
 * Debug Copilot SDK Tool Calls
 * Use event handlers to see what's happening
 */

import { CopilotClient, defineTool } from '@github/copilot-sdk';

async function main() {
  console.log('🔍 Debugging Copilot SDK Tool Calls\n');

  const client = new CopilotClient({
    logLevel: 'debug', // Enable debug logging
  });
  await client.start();
  console.log('✅ Client started\n');

  // Define a simple tool
  const execTool = defineTool({
    name: 'exec',
    description: 'Execute a shell command',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run' },
      },
      required: ['command'],
    },
    handler: async (params) => {
      console.log(`\n🔧 TOOL HANDLER CALLED: exec`);
      console.log(`   Command: ${params.command}`);
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);
      
      try {
        const { stdout } = await execPromise(params.command, { timeout: 5000 });
        console.log(`   Result: ${stdout.trim().slice(0, 100)}`);
        return stdout.trim();
      } catch (error) {
        console.error(`   Error: ${error.message}`);
        throw error;
      }
    },
  });

  // Create session
  const session = await client.createSession({
    model: 'gpt-5',
    tools: [execTool],
  });

  console.log(`Session: ${session.sessionId}\n`);

  // Log ALL events
  session.on('assistant.message', (event) => {
    console.log(`\n[assistant.message] ${event.data.content}`);
  });

  session.on('assistant.message_delta', (event) => {
    process.stdout.write(event.data.deltaContent);
  });

  session.on('tool.invocation', (event) => {
    console.log(`\n[tool.invocation] Tool: ${event.data.tool}, Params:`, JSON.stringify(event.data.params, null, 2));
  });

  session.on('tool.result', (event) => {
    console.log(`\n[tool.result] Tool: ${event.data.tool}, Result:`, event.data.result);
  });

  session.on('tool.execution_start', (event) => {
    console.log(`\n[tool.execution_start] Tool: ${event.data.tool}`);
  });

  session.on('tool.execution_end', (event) => {
    console.log(`\n[tool.execution_end] Tool: ${event.data.tool}`);
  });

  session.on('session.idle', () => {
    console.log(`\n[session.idle]`);
  });

  session.on('session.error', (event) => {
    console.error(`\n[session.error]`, event.data);
  });

  // Send message
  console.log('Sending message: "Use the exec tool to run: echo Hello World"');
  console.log('');
  
  try {
    await session.send({
      prompt: 'Use the exec tool to run the command: echo "Hello World"'
    });

    // Wait manually
    await new Promise(resolve => setTimeout(resolve, 20000));
    
  } catch (error) {
    console.error('Send error:', error);
  }

  await session.destroy();
  await client.stop();
  
  console.log('\n✅ Done\n');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
