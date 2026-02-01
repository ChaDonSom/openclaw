/**
 * Dead Simple Copilot SDK Test
 * Following the exact Quick Start example from the SDK docs
 */

import { CopilotClient, defineTool } from '@github/copilot-sdk';

async function main() {
  console.log('🧪 Simple Copilot SDK Test (Following SDK Docs)\n');

  const client = new CopilotClient();
  await client.start();
  console.log('✅ Client started\n');

  // Create session with gpt-5 (as shown in SDK quick start)
  const session = await client.createSession({
    model: 'gpt-5',
  });

  console.log(`Session created: ${session.sessionId}\n`);

  // Use sendAndWait instead of manual event handling
  console.log('Sending message...');
  const response = await session.sendAndWait({ 
    prompt: 'What is 2+2? Just give me the number.' 
  }, 10000);

  console.log('\n✅ Response received:', response?.data.content);

  // Test with a tool
  const mathTool = defineTool({
    name: 'add',
    description: 'Add two numbers',
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
    handler: async (params) => {
      console.log(`\n[Tool Called] add(${params.a}, ${params.b})`);
      const result = params.a + params.b;
      console.log(`[Tool Result] ${result}`);
      return result;
    },
  });

  // Create new session with tool
  const session2 = await client.createSession({
    model: 'gpt-5',
    tools: [mathTool],
  });

  console.log(`\nSession 2 created: ${session2.sessionId}`);
  console.log('Sending message with tool...');
  
  const response2 = await session2.sendAndWait({
    prompt: 'Use the add tool to calculate 137 + 259'
  }, 15000);

  console.log('\n✅ Response 2:', response2?.data.content);

  // Cleanup
  await session.destroy();
  await session2.destroy();
  await client.stop();

  console.log('\n✅ Test complete!\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
