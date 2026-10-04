/**
 * Hàm và hằng số dùng chung giữa nhiều nhóm route.
 *
 * Tách ra đây để mỗi route file chỉ import đúng thứ nó cần, tránh phụ thuộc vòng
 * (route A import route B chỉ vì cần 1 hàm nhỏ).
 */
import { db } from "../db/index.js";
import { classes } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { AuthRequest } from "../middleware/auth.js";

// ──────────────────────────────────────────────────────────────────────────────
// Hằng số
// ──────────────────────────────────────────────────────────────────────────────

/** Phiên điểm danh tự động hết hạn sau bao nhiêu giờ kể từ lúc mở. */
export const HANET_SESSION_EXPIRY_HOURS = 3;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Chuẩn hoá giờ về dạng HH:MM:SS để lưu và so sánh nhất quán. Trả null nếu sai định dạng. */
export const normalizeShiftTime = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
};

/** Kiểm tra người dùng có được thao tác với lớp này không (theo vai trò và chi nhánh). */
export const canManageClass = async (
  req: AuthRequest,
  tenantId: string,
  classId: number,
): Promise<boolean> => {
  if (req.dbUser?.role === "admin") return true;
  const conditions = [
    eq(classes.tenantId, tenantId),
    eq(classes.id, classId),
    eq(classes.isDeleted, false),
  ];
  if (req.dbUser?.role === "teacher" && req.dbUser.id) {
    conditions.push(eq(classes.teacherId, req.dbUser.id));
  } else if (req.dbUser?.branchId) {
    conditions.push(eq(classes.branchId, req.dbUser.branchId));
  }
  const allowed = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(...conditions))
    .limit(1);
  return allowed.length > 0;
};
