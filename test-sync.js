import { getOrCreateUser } from './src/db/users.js';
import { db } from './src/db/index.js';

async function test() {
  try {
    const res = await getOrCreateUser('test-uid', 'test@example.com', 'Test User');
    console.log(res);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
test();
