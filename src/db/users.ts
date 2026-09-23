import { db } from './index.js';
import { updateReturning } from './helpers.js';
import { users } from './schema.js';
import { eq } from 'drizzle-orm';
import type { DbUser } from '../middleware/auth.js';

/**
 * Trả về bản ghi người dùng nếu đã tồn tại (hoặc vừa được cập nhật uid),
 * hoặc `{ needsOnboarding: true }` nếu chưa có tài khoản nào trong hệ thống.
 */
export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
): Promise<DbUser | { needsOnboarding: true }> {
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
      const result = await updateReturning(
        db,
        users,
        { uid, name: user.name || name || null },
        eq(users.id, user.id),
      );
      return result[0] ?? user;
    }
    return user;
  }

  // If user does not exist at all, return a flag indicating they need onboarding
  return { needsOnboarding: true };
}
