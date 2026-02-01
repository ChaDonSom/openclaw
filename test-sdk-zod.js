/**
 * Test with Zod schema (as shown in SDK docs)
 */

import { z } from 'zod';
import { CopilotClient, defineTool } from '@github/copilot-sdk';

async function main() {
  console.log('🧪 Testing with Zod Schema\n');

  const client = new CopilotClient({
    useStdio: false,
    port: 0,
  });

  await client.start();
  console.log('✅ Client started\n');

  // Use Zod schema like the docs show
  const lookupTool = defineTool('get_number', {
    description: 'Get a magic number',
    parameters: z.object({
      multiplier: z.number().describe('Number to multiply by 2'),
    }),
    handler: async ({ multiplier }) => {
      console.log(`\n🔧 TOOL CALLED! multiplier=${multiplier}`);
      const result = multiplier * 2;
      console.log(`   Result: ${result}`);
      return result;
    },
  });

  const session = await client.createSession({
    model: 'gpt-5',
    tools: [lookupTool],
  });

  console.log(`Session: ${session.sessionId}\n`);

  session.on('assistant.message', (e) => console.log(`\n[Agent] ${e.data.content}`));
  session.on('tool.invocation', (e) => console.log(`\n[Invoked] ${e.data.tool}`));

  console.log('Sending message...\n');
  
  const response = await session.sendAndWait({
    prompt: 'Use the get_number tool with multiplier 21'
  }, 15000);

  console.log('\n✅ Response:', response?.data.content);

  await session.destroy();
  await client.stop();
  console.log('\n✅ Done\n');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
