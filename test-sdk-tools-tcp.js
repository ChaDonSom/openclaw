/**
 * Test SDK Tools with TCP Transport
 */

import { CopilotClient, defineTool } from '@github/copilot-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function main() {
  console.log('🧪 Testing SDK Tools with TCP\n');

  const client = new CopilotClient({
    useStdio: false, // TCP transport
    port: 0,
  });

  await client.start();
  console.log('✅ Client started\n');

  // Define exec tool
  const execTool = defineTool({
    name: 'exec',
    description: 'Execute a shell command',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
      required: ['command'],
    },
    handler: async (params) => {
      console.log(`\n🔧 EXEC TOOL CALLED!`);
      console.log(`   Command: ${params.command}`);
      const { stdout } = await execPromise(params.command, { timeout: 5000 });
      const result = stdout.trim();
      console.log(`   Result: ${result.slice(0, 100)}`);
      return result;
    },
  });

  // Create session with tool
  const session = await client.createSession({
    model: 'gpt-5',
    tools: [execTool],
  });

  console.log(`Session: ${session.sessionId}\n`);

  // Event handlers
  session.on('assistant.message', (event) => {
    console.log(`\n[Agent] ${event.data.content}`);
  });

  session.on('tool.invocation', (event) => {
    console.log(`\n[Tool Invoked] ${event.data.tool}`);
  });

  session.on('tool.execution_start', (event) => {
    console.log(`\n[Tool Start] ${event.data.tool}`);
  });

  session.on('tool.execution_end', (event) => {
    console.log(`\n[Tool End] ${event.data.tool}`);
  });

  // Send message
  console.log('Asking agent to use exec tool...\n');
  
  const response = await session.sendAndWait({
    prompt: 'Use the exec tool to run: echo "Hello from Copilot SDK!"'
  }, 15000);

  console.log('\n✅ Final response:', response?.data.content);

  await session.destroy();
  await client.stop();
  
  console.log('\n✅ Test complete!\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
