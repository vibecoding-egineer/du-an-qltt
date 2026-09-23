import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.js';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.js';
import { users, licenses } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

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

    // Kiểm tra giấy phép của trung tâm ở MỌI request, không chỉ lúc đăng ký - nếu chỉ kiểm tra
    // lúc tạo tenant thì sau đó khách dùng vĩnh viễn, hạn sử dụng không còn ý nghĩa gì.
    // Lỗi khi truy vấn giấy phép được cố ý BỎ QUA (cho đi tiếp): thà chấp nhận rủi ro nhỏ là
    // một trung tâm hết hạn vẫn dùng được thêm lúc nữa, còn hơn để cả hệ thống ngừng hoạt động
    // vì một trục trặc tạm thời của DB - dữ liệu vận hành thật quan trọng hơn việc siết hạn.
    if (req.dbUser?.tenantId) {
      try {
        const licenseRows = await db.select().from(licenses)
          .where(eq(licenses.tenantId, req.dbUser.tenantId))
          .limit(1);

        const license = licenseRows[0];
        if (!license) {
          return res.status(403).json({
            error: 'Trung tâm chưa được kích hoạt. Vui lòng liên hệ nhà cung cấp phần mềm.',
            licenseStatus: 'missing',
          });
        }
        if (license.isRevoked) {
          return res.status(403).json({
            error: 'Giấy phép đã bị thu hồi. Vui lòng liên hệ nhà cung cấp phần mềm.',
            licenseStatus: 'revoked',
          });
        }
        if (license.expiresAt.getTime() < Date.now()) {
          return res.status(403).json({
            error: 'Giấy phép sử dụng đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.',
            licenseStatus: 'expired',
            expiresAt: license.expiresAt,
          });
        }
      } catch (licenseErr) {
        console.error('Error checking license in auth middleware', licenseErr);
      }
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
