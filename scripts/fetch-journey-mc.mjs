import { config } from 'dotenv';
config({ path: 'C:/Users/gmunoz02/Desktop/agentOS/.env' });
import { createMCClient } from '../packages/core/mc-api/client.js';

// Use env-based client (no DB needed for scripts)
const mc = createMCClient(null, null);

const interactionId = process.argv[2] || 'b000f01b-ced5-42ff-8871-f24147708d71';
const j = await mc.rest('GET', `/interaction/v1/interactions/${interactionId}`);

console.log('=== ROOT FIELDS ===');
const { activities, triggers, ...root } = j;
console.log(JSON.stringify(root, null, 2));

console.log('\n=== TRIGGER[0] ===');
console.log(JSON.stringify(triggers?.[0], null, 2));

console.log('\n=== ACTIVITIES (first 2) ===');
for (const a of (activities || []).slice(0, 2)) {
  console.log(JSON.stringify(a, null, 2));
  console.log('---');
}
