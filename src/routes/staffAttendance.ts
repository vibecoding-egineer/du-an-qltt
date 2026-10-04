/**
 * Bảng công nhân viên — CRUD + tự động tính muộn / sớm
 *
 * Mỗi dòng = 1 bản ghi chấm công: NV + ngày + ca + giờ vào + giờ ra.
 * Một NV có thể có NHIỀU bản ghi trong cùng 1 ngày (mỗi ca 1 bản ghi).
 *
 * Logic tính muộn/sớm:
 *   - Nếu có shiftId → tra ca để lấy startTime/endTime
 *   - checkIn sau startTime → lateMinutes = chênh lệch (phút)
 *   - checkOut trước endTime → earlyLeaveMinutes = chênh lệch (phút)
 *   - Không có ca → lateMinutes = 0, earlyLeaveMinutes = 0
 *
 * Phân quyền:
 *   - admin: xem + sửa tất cả
 *   - manager: xem + sửa NV cùng chi nhánh
 *   - staff / teacher: chỉ xem công của chính mình
 */
import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { staffAttendance, staffShifts, shifts, users } from "../db/schema.js";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Chuyển "HH:MM" hoặc "HH:MM:SS" → tổng phút trong ngày. */
const timeToMinutes = (time: string): number => {
  const parts = time.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

/**
 * Tính lateMinutes và earlyLeaveMinutes.
 * Nếu thiếu checkIn/checkOut hoặc không có ca → trả 0.
 */
interface LateEarlyResult {
  lateMinutes: number;
  earlyLeaveMinutes: number;
}

const computeLateEarly = (
  checkInTime: string | null,
  checkOutTime: string | null,
  shiftStartTime: string | null,
  shiftEndTime: string | null,
): LateEarlyResult => {
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;

  if (!shiftStartTime || !shiftEndTime) {
    return { lateMinutes, earlyLeaveMinutes };
  }

  if (checkInTime) {
    // checkInTime là datetime string, lấy phần giờ: "2026-10-01T07:45:00" → "07:45"
    const checkInStr = new Date(checkInTime).toTimeString().slice(0, 5);
    const diff = timeToMinutes(checkInStr) - timeToMinutes(shiftStartTime);
    if (diff > 0) lateMinutes = diff;
  }

  if (checkOutTime) {
    const checkOutStr = new Date(checkOutTime).toTimeString().slice(0, 5);
    const diff = timeToMinutes(shiftEndTime) - timeToMinutes(checkOutStr);
    if (diff > 0) earlyLeaveMinutes = diff;
  }

  return { lateMinutes, earlyLeaveMinutes };
};

/** Tra startTime/endTime của ca từ DB. */
const getShiftTimes = async (
  shiftId: number,
  tenantId: string,
): Promise<{ startTime: string; endTime: string } | null> => {
  const rows = await db
    .select({ startTime: shifts.startTime, endTime: shifts.endTime })
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.tenantId, tenantId), eq(shifts.isDeleted, false)))
    .limit(1);
  return rows[0] || null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────────────────

export function registerStaffAttendanceRoutes(app: Express): void {
  /**
   * Bảng công trong khoảng ngày.
   * Query: ?startDate=2026-10-01&endDate=2026-10-31&userId=5 (userId tùy chọn)
   */
  app.get("/api/staff-attendance", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { startDate, endDate, userId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate và endDate là bắt buộc." });
      }

      const conditions = [
        eq(staffAttendance.tenantId, tenantId),
        eq(staffAttendance.isDeleted, false),
        gte(staffAttendance.workDate, startDate as string),
        lte(staffAttendance.workDate, endDate as string),
      ];

      // Lọc theo userId nếu có
      if (userId) {
        conditions.push(eq(staffAttendance.userId, parseInt(userId as string)));
      }

      // Phân quyền theo vai trò
      if (req.dbUser?.role === "teacher" || req.dbUser?.role === "staff") {
        conditions.push(eq(staffAttendance.userId, req.dbUser.id));
      } else if (req.dbUser?.role === "manager" && req.dbUser.branchId) {
        const branchUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.branchId, req.dbUser.branchId)));
        const branchUserIds = branchUsers.map((u) => u.id);
        if (branchUserIds.length === 0) return res.json([]);
        conditions.push(inArray(staffAttendance.userId, branchUserIds));
      }

      const result = await db
        .select({
          id: staffAttendance.id,
          userId: staffAttendance.userId,
          userName: users.name,
          userEmail: users.email,
          workDate: staffAttendance.workDate,
          shiftId: staffAttendance.shiftId,
          shiftName: shifts.name,
          shiftStartTime: shifts.startTime,
          shiftEndTime: shifts.endTime,
          checkInTime: staffAttendance.checkInTime,
          checkOutTime: staffAttendance.checkOutTime,
          lateMinutes: staffAttendance.lateMinutes,
          earlyLeaveMinutes: staffAttendance.earlyLeaveMinutes,
          source: staffAttendance.source,
          note: staffAttendance.note,
        })
        .from(staffAttendance)
        .innerJoin(users, eq(staffAttendance.userId, users.id))
        .leftJoin(shifts, eq(staffAttendance.shiftId, shifts.id))
        .where(and(...conditions))
        .orderBy(staffAttendance.workDate, users.name, shifts.startTime);

      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch staff attendance" });
    }
  });

  /**
   * Chấm công thủ công.
   * Body: { userId, workDate, shiftId?, checkInTime?, checkOutTime?, note? }
   *
   * Nếu NV có ca phân (staffShifts) cho ngày đó, tự chọn ca mặc định.
   * Tính lateMinutes / earlyLeaveMinutes dựa trên ca.
   */
  app.post(
    "/api/staff-attendance",
    requireAuth,
    requireRole(["admin", "manager"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { userId, workDate, shiftId, checkInTime, checkOutTime, note } = req.body;

        if (!userId || !workDate) {
          return res.status(400).json({ error: "Thiếu thông tin nhân viên hoặc ngày." });
        }

        const parsedUserId = parseInt(userId);
        const parsedShiftId = shiftId ? parseInt(shiftId) : null;

        // Manager chỉ chấm công cho NV cùng chi nhánh
        if (req.dbUser?.role === "manager" && req.dbUser.branchId) {
          const target = await db
            .select({ branchId: users.branchId })
            .from(users)
            .where(and(eq(users.id, parsedUserId), eq(users.tenantId, tenantId)))
            .limit(1);
          if (target.length === 0 || target[0].branchId !== req.dbUser.branchId) {
            return res.status(403).json({ error: "Nhân viên này không thuộc chi nhánh của bạn." });
          }
        }

        // Nếu chưa chọn ca, tìm ca đã phân trong ngày đó (lấy ca đầu tiên)
        let resolvedShiftId = parsedShiftId;
        if (!resolvedShiftId) {
          const assigned = await db
            .select({ shiftId: staffShifts.shiftId })
            .from(staffShifts)
            .where(
              and(
                eq(staffShifts.tenantId, tenantId),
                eq(staffShifts.userId, parsedUserId),
                eq(staffShifts.workDate, workDate),
                eq(staffShifts.isDeleted, false),
              ),
            )
            .limit(1);
          if (assigned.length > 0) resolvedShiftId = assigned[0].shiftId;
        }

        // Tính muộn / sớm
        let lateEarly: LateEarlyResult = { lateMinutes: 0, earlyLeaveMinutes: 0 };
        if (resolvedShiftId) {
          const shiftTimes = await getShiftTimes(resolvedShiftId, tenantId);
          if (shiftTimes) {
            lateEarly = computeLateEarly(
              checkInTime || null,
              checkOutTime || null,
              shiftTimes.startTime,
              shiftTimes.endTime,
            );
          }
        }

        const result = await insertReturning(db, staffAttendance, {
          tenantId,
          userId: parsedUserId,
          workDate,
          shiftId: resolvedShiftId,
          checkInTime: checkInTime ? new Date(checkInTime) : null,
          checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
          lateMinutes: lateEarly.lateMinutes,
          earlyLeaveMinutes: lateEarly.earlyLeaveMinutes,
          source: "manual",
          note: note || null,
        });

        res.json(result);
      } catch (error: unknown) {
        const errObj = error as any;
        if (errObj?.code === "ER_DUP_ENTRY" || errObj?.errno === 1062) {
          return res.status(400).json({
            error: "Nhân viên đã có bản ghi công cho ca này trong ngày đó.",
          });
        }
        console.error(error);
        res.status(500).json({ error: "Failed to create attendance record" });
      }
    },
  );

  /**
   * Sửa bản ghi công.
   * Body: { checkInTime?, checkOutTime?, shiftId?, note? }
   * Tự tính lại muộn / sớm sau khi sửa.
   */
  app.put(
    "/api/staff-attendance/:id",
    requireAuth,
    requireRole(["admin", "manager"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const recordId = parseInt(req.params.id);
        const { checkInTime, checkOutTime, shiftId, note } = req.body;

        // Lấy bản ghi hiện tại
        const existing = await db
          .select()
          .from(staffAttendance)
          .where(
            and(
              eq(staffAttendance.id, recordId),
              eq(staffAttendance.tenantId, tenantId),
              eq(staffAttendance.isDeleted, false),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy bản ghi công." });
        }

        const record = existing[0];

        // Manager chỉ sửa công NV cùng chi nhánh
        if (req.dbUser?.role === "manager" && req.dbUser.branchId) {
          const target = await db
            .select({ branchId: users.branchId })
            .from(users)
            .where(eq(users.id, record.userId))
            .limit(1);
          if (target.length === 0 || target[0].branchId !== req.dbUser.branchId) {
            return res.status(403).json({ error: "Nhân viên này không thuộc chi nhánh của bạn." });
          }
        }

        const newCheckIn = checkInTime !== undefined ? checkInTime : record.checkInTime;
        const newCheckOut = checkOutTime !== undefined ? checkOutTime : record.checkOutTime;
        const newShiftId = shiftId !== undefined ? (shiftId ? parseInt(shiftId) : null) : record.shiftId;

        // Tính lại muộn / sớm
        let lateEarly: LateEarlyResult = { lateMinutes: 0, earlyLeaveMinutes: 0 };
        if (newShiftId) {
          const shiftTimes = await getShiftTimes(newShiftId, tenantId);
          if (shiftTimes) {
            lateEarly = computeLateEarly(
              newCheckIn ? (typeof newCheckIn === "string" ? newCheckIn : newCheckIn.toISOString()) : null,
              newCheckOut ? (typeof newCheckOut === "string" ? newCheckOut : newCheckOut.toISOString()) : null,
              shiftTimes.startTime,
              shiftTimes.endTime,
            );
          }
        }

        const result = await updateReturning(
          db,
          staffAttendance,
          {
            checkInTime: newCheckIn ? new Date(newCheckIn) : null,
            checkOutTime: newCheckOut ? new Date(newCheckOut) : null,
            shiftId: newShiftId,
            lateMinutes: lateEarly.lateMinutes,
            earlyLeaveMinutes: lateEarly.earlyLeaveMinutes,
            note: note !== undefined ? note : record.note,
          },
          and(
            eq(staffAttendance.id, recordId),
            eq(staffAttendance.tenantId, tenantId),
            eq(staffAttendance.isDeleted, false),
          ),
        );

        if (result.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy bản ghi công." });
        }
        res.json(result[0]);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update attendance record" });
      }
    },
  );
}
