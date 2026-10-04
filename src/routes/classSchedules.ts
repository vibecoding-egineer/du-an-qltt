/**
 * Thời khóa biểu lớp học — CRUD
 *
 * Mỗi dòng là một buổi cố định trong tuần: lớp nào, thứ mấy, ca nào.
 * Một lớp có nhiều dòng, mỗi buổi được phép dùng ca khác nhau.
 *
 * Phân quyền: dùng chung quy tắc với quản lý lớp học - ai sửa được lớp thì sửa được
 * lịch của lớp đó. Không dùng quyền '/shifts' vì đây là việc xếp lớp, không phải việc
 * định nghĩa khung giờ.
 */
import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { classes, classSchedules, shifts } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { canManageClass } from "./_helpers.js";

export function registerClassScheduleRoutes(app: Express): void {
  // Truyền ?classId=... để lấy lịch của một lớp (dùng ở form sửa lớp).
  // Không truyền thì lấy toàn bộ lịch trong phạm vi được phép (dùng ở trang lịch tuần).
  app.get("/api/class-schedules", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId } = req.query;

      let allowedClassIds: number[] | null = null;
      if (req.dbUser?.role === "teacher") {
        const allowed = await db
          .select({ id: classes.id })
          .from(classes)
          .where(
            and(
              eq(classes.tenantId, tenantId),
              eq(classes.teacherId, req.dbUser.id),
              eq(classes.isDeleted, false),
            ),
          );
        allowedClassIds = allowed.map((c) => c.id);
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowed = await db
          .select({ id: classes.id })
          .from(classes)
          .where(
            and(
              eq(classes.tenantId, tenantId),
              eq(classes.branchId, req.dbUser.branchId),
              eq(classes.isDeleted, false),
            ),
          );
        allowedClassIds = allowed.map((c) => c.id);
      }
      if (allowedClassIds && allowedClassIds.length === 0) {
        return res.json([]);
      }

      const conditions = [
        eq(classSchedules.tenantId, tenantId),
        eq(classSchedules.isDeleted, false),
        eq(classes.isDeleted, false),
        eq(shifts.isDeleted, false),
      ];
      if (classId) {
        conditions.push(eq(classSchedules.classId, parseInt(classId as string)));
      }
      if (allowedClassIds) {
        conditions.push(inArray(classSchedules.classId, allowedClassIds));
      }

      const result = await db
        .select({
          id: classSchedules.id,
          classId: classSchedules.classId,
          className: classes.name,
          branchId: classes.branchId,
          teacherId: classes.teacherId,
          shiftId: classSchedules.shiftId,
          shiftName: shifts.name,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
          dayOfWeek: classSchedules.dayOfWeek,
        })
        .from(classSchedules)
        .innerJoin(classes, eq(classSchedules.classId, classes.id))
        .innerJoin(shifts, eq(classSchedules.shiftId, shifts.id))
        .where(and(...conditions))
        .orderBy(classSchedules.dayOfWeek, shifts.startTime);

      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch class schedules" });
    }
  });

  app.post(
    "/api/class-schedules",
    requireAuth,
    requireRole(["admin", "manager", "staff", "teacher"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { classId, shiftId, dayOfWeek } = req.body;

        const parsedClassId = parseInt(classId);
        const parsedShiftId = parseInt(shiftId);
        const parsedDay = parseInt(dayOfWeek);

        if (!parsedClassId || !parsedShiftId || isNaN(parsedDay)) {
          return res
            .status(400)
            .json({ error: "Thiếu thông tin lớp, ca hoặc thứ." });
        }
        if (parsedDay < 1 || parsedDay > 7) {
          return res.status(400).json({ error: "Thứ không hợp lệ." });
        }

        if (!(await canManageClass(req, tenantId, parsedClassId))) {
          return res
            .status(403)
            .json({ error: "Bạn không có quyền xếp lịch cho lớp này." });
        }

        const shiftRows = await db
          .select({ id: shifts.id })
          .from(shifts)
          .where(
            and(
              eq(shifts.id, parsedShiftId),
              eq(shifts.tenantId, tenantId),
              eq(shifts.isDeleted, false),
            ),
          )
          .limit(1);
        if (shiftRows.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy ca làm việc." });
        }

        const result = await insertReturning(db, classSchedules, {
          tenantId,
          classId: parsedClassId,
          shiftId: parsedShiftId,
          dayOfWeek: parsedDay,
        });
        res.json(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "";
        const errObj = error as any;
        if (
          errObj?.code === "ER_DUP_ENTRY" ||
          errObj?.errno === 1062 ||
          message.includes("Duplicate entry")
        ) {
          return res
            .status(400)
            .json({ error: "Lớp này đã có lịch vào ca đó trong cùng ngày." });
        }
        console.error(error);
        res.status(500).json({ error: "Failed to create class schedule" });
      }
    },
  );

  app.delete(
    "/api/class-schedules/:id",
    requireAuth,
    requireRole(["admin", "manager", "staff", "teacher"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const scheduleId = parseInt(req.params.id);

        const existing = await db
          .select()
          .from(classSchedules)
          .where(
            and(
              eq(classSchedules.id, scheduleId),
              eq(classSchedules.tenantId, tenantId),
              eq(classSchedules.isDeleted, false),
            ),
          )
          .limit(1);
        if (existing.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy lịch học." });
        }

        if (!(await canManageClass(req, tenantId, existing[0].classId))) {
          return res
            .status(403)
            .json({ error: "Bạn không có quyền sửa lịch của lớp này." });
        }

        await updateReturning(
          db,
          classSchedules,
          { isDeleted: true, deletedAt: new Date() },
          and(
            eq(classSchedules.id, scheduleId),
            eq(classSchedules.tenantId, tenantId),
            eq(classSchedules.isDeleted, false),
          ),
        );
        res.json({ success: true });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete class schedule" });
      }
    },
  );
}
