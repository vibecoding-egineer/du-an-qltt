/**
 * Ca làm việc — CRUD
 *
 * Ca chỉ là khung giờ có tên, dùng lại cho cả thời khóa biểu lớp lẫn phân ca nhân viên.
 *
 * Phân quyền: đọc thì ai đăng nhập cũng được (giáo viên cần xem lịch, nhân viên cần xem
 * ca của mình). Ghi thì chỉ admin, hoặc người được admin cấp quyền '/shifts' riêng.
 */
import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { shifts, classSchedules, staffShifts, staffAttendance } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { normalizeShiftTime } from "./_helpers.js";

export function registerShiftRoutes(app: Express): void {
  app.get("/api/shifts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const result = await db
        .select()
        .from(shifts)
        .where(and(eq(shifts.tenantId, tenantId), eq(shifts.isDeleted, false)))
        .orderBy(shifts.startTime);
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

  app.post(
    "/api/shifts",
    requireAuth,
    requirePermission("/shifts"),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { name, startTime, endTime, isAdministrative } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Vui lòng nhập tên ca." });
        }
        const start = normalizeShiftTime(startTime);
        const end = normalizeShiftTime(endTime);
        if (!start || !end) {
          return res
            .status(400)
            .json({ error: "Giờ không hợp lệ. Định dạng đúng là HH:MM." });
        }
        // Chưa hỗ trợ ca qua đêm (ví dụ 22:00 - 06:00). Nếu về sau trung tâm cần, phải thêm
        // cờ đánh dấu ca qua đêm rồi sửa cả phần tính giờ công, không chỉ bỏ điều kiện này.
        if (end <= start) {
          return res
            .status(400)
            .json({ error: "Giờ kết thúc phải sau giờ bắt đầu." });
        }

        const result = await insertReturning(db, shifts, {
          tenantId,
          name: name.trim(),
          startTime: start,
          endTime: end,
          isAdministrative: !!isAdministrative,
        });
        res.json(result);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to create shift" });
      }
    },
  );

  app.put(
    "/api/shifts/:id",
    requireAuth,
    requirePermission("/shifts"),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const shiftId = parseInt(req.params.id);
        const { name, startTime, endTime, isAdministrative } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Vui lòng nhập tên ca." });
        }
        const start = normalizeShiftTime(startTime);
        const end = normalizeShiftTime(endTime);
        if (!start || !end) {
          return res
            .status(400)
            .json({ error: "Giờ không hợp lệ. Định dạng đúng là HH:MM." });
        }
        if (end <= start) {
          return res
            .status(400)
            .json({ error: "Giờ kết thúc phải sau giờ bắt đầu." });
        }

        const result = await updateReturning(
          db,
          shifts,
          {
            name: name.trim(),
            startTime: start,
            endTime: end,
            isAdministrative: !!isAdministrative,
          },
          and(
            eq(shifts.id, shiftId),
            eq(shifts.tenantId, tenantId),
            eq(shifts.isDeleted, false),
          ),
        );

        if (result.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy ca làm việc." });
        }
        res.json(result[0]);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update shift" });
      }
    },
  );

  app.delete(
    "/api/shifts/:id",
    requireAuth,
    requirePermission("/shifts"),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const shiftId = parseInt(req.params.id);

        // CHẶN XÓA KHI CA ĐANG ĐƯỢC DÙNG. Xóa ca đang gắn với lịch học hoặc bảng công sẽ
        // làm những bản ghi đó trỏ tới một ca không còn tồn tại.
        const [usedInClasses, usedInRoster, usedInTimesheet] = await Promise.all([
          db
            .select({ id: classSchedules.id })
            .from(classSchedules)
            .where(
              and(eq(classSchedules.shiftId, shiftId), eq(classSchedules.isDeleted, false)),
            ),
          db
            .select({ id: staffShifts.id })
            .from(staffShifts)
            .where(
              and(eq(staffShifts.shiftId, shiftId), eq(staffShifts.isDeleted, false)),
            ),
          db
            .select({ id: staffAttendance.id })
            .from(staffAttendance)
            .where(
              and(
                eq(staffAttendance.shiftId, shiftId),
                eq(staffAttendance.isDeleted, false),
              ),
            ),
        ]);

        if (
          usedInClasses.length > 0 ||
          usedInRoster.length > 0 ||
          usedInTimesheet.length > 0
        ) {
          const reasons: string[] = [];
          if (usedInClasses.length > 0)
            reasons.push(`${usedInClasses.length} lịch học`);
          if (usedInRoster.length > 0)
            reasons.push(`${usedInRoster.length} lượt phân ca nhân viên`);
          if (usedInTimesheet.length > 0)
            reasons.push(`${usedInTimesheet.length} bản ghi chấm công`);
          return res.status(400).json({
            error: `Không thể xóa vì ca này đang được dùng ở ${reasons.join(", ")}. Vui lòng gỡ khỏi những chỗ đó trước.`,
            usage: {
              classSchedules: usedInClasses.length,
              staffShifts: usedInRoster.length,
              staffAttendance: usedInTimesheet.length,
            },
          });
        }

        const result = await updateReturning(
          db,
          shifts,
          { isDeleted: true, deletedAt: new Date() },
          and(
            eq(shifts.id, shiftId),
            eq(shifts.tenantId, tenantId),
            eq(shifts.isDeleted, false),
          ),
        );

        if (result.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy ca làm việc." });
        }
        res.json({ success: true });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete shift" });
      }
    },
  );
}
