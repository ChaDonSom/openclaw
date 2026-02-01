/**
 * Test SDK with TCP instead of stdio
 */

import { CopilotClient } from '@github/copilot-sdk';

async function main() {
  console.log('🧪 Testing SDK with TCP transport\n');

  const client = new CopilotClient({
    useStdio: false, // Use TCP instead
    port: 0, // Random port
    logLevel: 'info',
  });

  try {
    await client.start();
    console.log('✅ Client started');
    
    const state = client.getState();
    console.log('Connection state:', state);
    
    const ping = await client.ping('hello');
    console.log('Ping response:', ping);

    const session = await client.createSession({
      model: 'gpt-5',
    });

    console.log(`Session: ${session.sessionId}`);
    
    const response = await session.sendAndWait({
      prompt: 'What is 5+3?'
    }, 10000);

    console.log('Response:', response?.data.content);

    await session.destroy();
    await client.stop();
    
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await client.stop();
    process.exit(1);
  }
}

main();
