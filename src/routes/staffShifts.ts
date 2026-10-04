/**
 * Phân ca nhân viên — CRUD
 *
 * Mỗi dòng = 1 nhân viên được phân vào 1 ca trong 1 ngày cụ thể.
 * Một nhân viên có thể được phân NHIỀU ca trong cùng 1 ngày (sáng + chiều).
 *
 * Phân quyền:
 *   - admin: xem + sửa tất cả
 *   - manager: xem + sửa NV cùng chi nhánh
 *   - staff / teacher: chỉ xem ca của chính mình
 */
import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { staffShifts, shifts, users } from "../db/schema.js";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export function registerStaffShiftRoutes(app: Express): void {
  /**
   * Danh sách phân ca trong khoảng ngày.
   * Query: ?startDate=2026-10-01&endDate=2026-10-07
   *
   * Trả về JOIN users + shifts để frontend không cần gọi thêm.
   */
  app.get("/api/staff-shifts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate và endDate là bắt buộc." });
      }

      const conditions = [
        eq(staffShifts.tenantId, tenantId),
        eq(staffShifts.isDeleted, false),
        gte(staffShifts.workDate, startDate as string),
        lte(staffShifts.workDate, endDate as string),
      ];

      // Phân quyền theo vai trò
      if (req.dbUser?.role === "teacher" || req.dbUser?.role === "staff") {
        // NV / giáo viên chỉ xem ca của chính mình
        conditions.push(eq(staffShifts.userId, req.dbUser.id));
      } else if (req.dbUser?.role === "manager" && req.dbUser.branchId) {
        // Manager xem NV cùng chi nhánh
        const branchUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.tenantId, tenantId), eq(users.branchId, req.dbUser.branchId)));
        const branchUserIds = branchUsers.map((u) => u.id);
        if (branchUserIds.length === 0) return res.json([]);
        conditions.push(inArray(staffShifts.userId, branchUserIds));
      }
      // admin: không thêm filter → xem tất cả

      const result = await db
        .select({
          id: staffShifts.id,
          userId: staffShifts.userId,
          userName: users.name,
          userEmail: users.email,
          shiftId: staffShifts.shiftId,
          shiftName: shifts.name,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
          workDate: staffShifts.workDate,
        })
        .from(staffShifts)
        .innerJoin(users, eq(staffShifts.userId, users.id))
        .innerJoin(shifts, eq(staffShifts.shiftId, shifts.id))
        .where(and(...conditions))
        .orderBy(staffShifts.workDate, users.name, shifts.startTime);

      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch staff shifts" });
    }
  });

  /**
   * Phân ca đơn: 1 NV, 1 ca, 1 ngày.
   */
  app.post(
    "/api/staff-shifts",
    requireAuth,
    requireRole(["admin", "manager"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { userId, shiftId, workDate } = req.body;

        if (!userId || !shiftId || !workDate) {
          return res.status(400).json({ error: "Thiếu thông tin nhân viên, ca hoặc ngày." });
        }

        // Manager chỉ phân ca cho NV cùng chi nhánh
        if (req.dbUser?.role === "manager" && req.dbUser.branchId) {
          const target = await db
            .select({ branchId: users.branchId })
            .from(users)
            .where(and(eq(users.id, parseInt(userId)), eq(users.tenantId, tenantId)))
            .limit(1);
          if (target.length === 0 || target[0].branchId !== req.dbUser.branchId) {
            return res.status(403).json({ error: "Nhân viên này không thuộc chi nhánh của bạn." });
          }
        }

        // Kiểm tra ca tồn tại
        const shiftRows = await db
          .select({ id: shifts.id })
          .from(shifts)
          .where(and(eq(shifts.id, parseInt(shiftId)), eq(shifts.tenantId, tenantId), eq(shifts.isDeleted, false)))
          .limit(1);
        if (shiftRows.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy ca làm việc." });
        }

        const result = await insertReturning(db, staffShifts, {
          tenantId,
          userId: parseInt(userId),
          shiftId: parseInt(shiftId),
          workDate,
        });

        res.json(result);
      } catch (error: unknown) {
        const errObj = error as any;
        if (errObj?.code === "ER_DUP_ENTRY" || errObj?.errno === 1062) {
          return res.status(400).json({ error: "Nhân viên đã được phân ca này trong ngày đó." });
        }
        console.error(error);
        res.status(500).json({ error: "Failed to assign shift" });
      }
    },
  );

  /**
   * Phân ca hàng loạt: 1 NV, 1 ca, nhiều ngày.
   * Body: { userId, shiftId, dates: ["2026-10-01", "2026-10-02", ...] }
   */
  app.post(
    "/api/staff-shifts/bulk",
    requireAuth,
    requireRole(["admin", "manager"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { userId, shiftId, dates } = req.body;

        if (!userId || !shiftId || !Array.isArray(dates) || dates.length === 0) {
          return res
            .status(400)
            .json({ error: "Thiếu thông tin nhân viên, ca hoặc danh sách ngày." });
        }

        if (dates.length > 31) {
          return res.status(400).json({ error: "Tối đa 31 ngày mỗi lần phân ca." });
        }

        const parsedUserId = parseInt(userId);
        const parsedShiftId = parseInt(shiftId);

        // Manager chỉ phân ca cho NV cùng chi nhánh
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

        // Lọc bỏ những ngày đã phân ca rồi (tránh lỗi duplicate, không dùng transaction
        // để 1 ngày trùng không làm hỏng cả batch)
        const existingRows = await db
          .select({ workDate: staffShifts.workDate })
          .from(staffShifts)
          .where(
            and(
              eq(staffShifts.tenantId, tenantId),
              eq(staffShifts.userId, parsedUserId),
              eq(staffShifts.shiftId, parsedShiftId),
              eq(staffShifts.isDeleted, false),
              inArray(staffShifts.workDate, dates),
            ),
          );

        const existingDates = new Set(existingRows.map((r) => r.workDate));
        const newDates = (dates as string[]).filter((d) => !existingDates.has(d));

        if (newDates.length === 0) {
          return res.json({ created: 0, skipped: dates.length, message: "Tất cả các ngày đã được phân ca trước đó." });
        }

        await db.insert(staffShifts).values(
          newDates.map((date) => ({
            tenantId,
            userId: parsedUserId,
            shiftId: parsedShiftId,
            workDate: date,
          })),
        );

        res.json({
          created: newDates.length,
          skipped: dates.length - newDates.length,
        });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to bulk assign shifts" });
      }
    },
  );

  /**
   * Xóa mềm 1 lượt phân ca.
   */
  app.delete(
    "/api/staff-shifts/:id",
    requireAuth,
    requireRole(["admin", "manager"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const assignmentId = parseInt(req.params.id);

        // Manager chỉ xóa phân ca của NV cùng chi nhánh
        if (req.dbUser?.role === "manager" && req.dbUser.branchId) {
          const assignment = await db
            .select({ userId: staffShifts.userId })
            .from(staffShifts)
            .where(
              and(
                eq(staffShifts.id, assignmentId),
                eq(staffShifts.tenantId, tenantId),
                eq(staffShifts.isDeleted, false),
              ),
            )
            .limit(1);
          if (assignment.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy lượt phân ca." });
          }

          const target = await db
            .select({ branchId: users.branchId })
            .from(users)
            .where(eq(users.id, assignment[0].userId))
            .limit(1);
          if (target.length === 0 || target[0].branchId !== req.dbUser.branchId) {
            return res.status(403).json({ error: "Nhân viên này không thuộc chi nhánh của bạn." });
          }
        }

        const result = await updateReturning(
          db,
          staffShifts,
          { isDeleted: true, deletedAt: new Date() },
          and(
            eq(staffShifts.id, assignmentId),
            eq(staffShifts.tenantId, tenantId),
            eq(staffShifts.isDeleted, false),
          ),
        );

        if (result.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy lượt phân ca." });
        }
        res.json({ success: true });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete shift assignment" });
      }
    },
  );
}
