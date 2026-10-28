/**
 * Hàm và hằng số dùng chung giữa nhiều nhóm route.
 *
 * Tách ra đây để mỗi route file chỉ import đúng thứ nó cần, tránh phụ thuộc vòng
 * (route A import route B chỉ vì cần 1 hàm nhỏ).
 */
import { db } from "../db/index.js";
import { classes } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import type { Column, SQL } from "drizzle-orm";
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

/**
 * Tạo điều kiện SQL lọc theo cơ sở được phân quyền cho nhân viên.
 *
 * - Admin → `undefined` (xem tất cả; dùng trong `and()` sẽ tự bỏ qua).
 * - Non-admin có 1 cơ sở → `eq(field, id)` (tối ưu, tránh IN khi không cần).
 * - Non-admin có nhiều cơ sở → `inArray(field, ids)`.
 * - Non-admin KHÔNG có cơ sở nào → `eq(field, -1)` (luôn trả rỗng, an toàn).
 *
 * @param req     Request đã qua requireAuth (có `dbUser` và `allowedBranchIds`)
 * @param branchField  Cột branchId cần lọc (vd: `classes.branchId`, `branches.id`)
 */
export function getBranchFilter(req: AuthRequest, branchField: Column): SQL | undefined {
  if (req.dbUser?.role === 'admin') return undefined;
  const ids = req.allowedBranchIds;
  if (!ids || ids.length === 0) return eq(branchField, -1);
  if (ids.length === 1) return eq(branchField, ids[0]);
  return inArray(branchField, ids);
}

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
  } else {
    // Lọc theo danh sách cơ sở được phân quyền (multi-branch).
    // Thay thế logic cũ: eq(classes.branchId, req.dbUser.branchId) → chỉ 1 cơ sở.
    const branchFilter = getBranchFilter(req, classes.branchId);
    if (branchFilter) conditions.push(branchFilter);
  }
  const allowed = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(...conditions))
    .limit(1);
  return allowed.length > 0;
};
