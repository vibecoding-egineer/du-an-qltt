import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.js';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Kiểu dữ liệu người dùng lấy từ bảng `users`, suy ra tự động từ schema Drizzle
// (không khai báo tay để tránh lệch khi schema.ts thay đổi).
export type DbUser = typeof users.$inferSelect;

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    try {
      const dbUserResult = await db.select().from(users).where(eq(users.uid, decodedToken.uid));
      if (dbUserResult.length > 0) {
        req.dbUser = dbUserResult[0];
      }
    } catch (dbErr) {
      console.error('Error fetching dbUser in auth middleware', dbErr);
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
