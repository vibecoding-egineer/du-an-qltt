import { db } from './index.js';
import { users } from './schema.js';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  // Check if a user with this UID already exists
  const userByUid = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  if (userByUid.length > 0) {
    return userByUid[0];
  }

  // Check if a user with this email already exists (might be invited by an admin)
  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (existingUser.length > 0) {
    const user = existingUser[0];
    // If user exists but has a pending uid, update them
    if (user.uid !== uid || (!user.name && name)) {
      const result = await db.update(users)
        .set({ uid, name: user.name || name || null })
        .where(eq(users.id, user.id))
        .returning();
      return result[0];
    }
    return user;
  }

  // If user does not exist at all, return a flag indicating they need onboarding
  return { needsOnboarding: true };
}
