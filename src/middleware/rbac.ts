import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';

/**
 * Chỉ cho phép các role nằm trong danh sách `allowedRoles` đi tiếp.
 * BẮT BUỘC đặt SAU requireAuth trong chuỗi middleware (cần req.dbUser đã được gắn sẵn).
 *
 * Ví dụ:
 *   app.delete('/api/students/:id', requireAuth, requireRole(['admin', 'manager', 'staff']), handler)
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.dbUser?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
}

/**
 * Cho phép đi tiếp nếu là admin, HOẶC nếu user có permission cụ thể trong mảng `permissions`.
 * Dùng cho các tính năng bật/tắt theo từng nhân sự (ví dụ: quản lý khuyến mãi).
 *
 * Ví dụ:
 *   app.post('/api/promotions', requireAuth, requirePermission('/promotions'), handler)
 */
export function requirePermission(permissionKey: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const isAdmin = req.dbUser?.role === 'admin';
    const hasPermission = req.dbUser?.permissions?.includes(permissionKey) ?? false;
    if (!isAdmin && !hasPermission) {
      return res.status(403).json({ error: 'Không có quyền.' });
    }
    next();
  };
}
