import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { classes, attendance, attendanceSessions } from "../db/schema.js";
import { eq, and, gte, lte, inArray, desc, isNull } from "drizzle-orm";
import { canManageClass, HANET_SESSION_EXPIRY_HOURS } from "./_helpers.js";

export function registerAttendanceRoutes(app: Express): void {
  // ===== Điểm danh =====
  app.get("/api/attendance", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId, date } = req.query;
      if (!classId || !date) {
        return res.status(400).json({ error: "classId and date are required" });
      }

      if (req.dbUser?.role === "teacher") {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.id, parseInt(classId as string))));
        if (allowed.length === 0) return res.status(403).json({ error: "Forbidden access to this class" });
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(classId as string))));
        if (allowed.length === 0) return res.status(403).json({ error: "Forbidden access to this class" });
      }

      const queryDate = new Date(date as string);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

      const result = await db.select().from(attendance).where(and(eq(attendance.tenantId, tenantId), eq(attendance.isDeleted, false), eq(attendance.classId, parseInt(classId as string)), gte(attendance.date, startOfDay), lte(attendance.date, endOfDay)));
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { studentId, classId, date, status, homeworkCompleted, note } = req.body;

      if (req.dbUser?.role === "teacher") {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.id, parseInt(classId))));
        if (allowed.length === 0) return res.status(403).json({ error: "Forbidden access to this class" });
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(classId))));
        if (allowed.length === 0) return res.status(403).json({ error: "Forbidden access to this class" });
      }

      const queryDate = new Date(date as string);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

      const result = await db.transaction(async (tx) => {
        await tx.update(attendance).set({ isDeleted: true, deletedAt: new Date() }).where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, parseInt(studentId)), eq(attendance.classId, parseInt(classId)), eq(attendance.isDeleted, false), gte(attendance.date, startOfDay), lte(attendance.date, endOfDay)));
        return await insertReturning(tx, attendance, { tenantId, studentId: parseInt(studentId), classId: parseInt(classId), date: new Date(date), status, homeworkCompleted: homeworkCompleted ? 1 : 0, note });
      });
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to mark attendance" });
    }
  });

  // ===== Phiên điểm danh =====
  app.get("/api/attendance-sessions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId } = req.query;

      let allowedClassIds: number[] | null = null;
      if (req.dbUser?.role === "teacher") {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.isDeleted, false)));
        allowedClassIds = allowed.map((c) => c.id);
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.isDeleted, false)));
        allowedClassIds = allowed.map((c) => c.id);
      }
      if (allowedClassIds && allowedClassIds.length === 0) return res.json([]);

      const sessionExpiry = new Date(Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
      const conditions = [eq(attendanceSessions.tenantId, tenantId), isNull(attendanceSessions.closedAt), gte(attendanceSessions.openedAt, sessionExpiry)];
      if (classId) conditions.push(eq(attendanceSessions.classId, parseInt(classId as string)));
      if (allowedClassIds) conditions.push(inArray(attendanceSessions.classId, allowedClassIds));

      const result = await db.select().from(attendanceSessions).where(and(...conditions)).orderBy(desc(attendanceSessions.openedAt));
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch attendance sessions" });
    }
  });

  app.post("/api/attendance-sessions", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(403).json({ error: "Không xác định được người dùng" });
      const tenantId = req.dbUser.tenantId || req.user!.uid;
      const { classId, taughtBy } = req.body;

      if (!classId || isNaN(parseInt(classId))) return res.status(400).json({ error: "classId là bắt buộc" });
      const parsedClassId = parseInt(classId);
      const parsedTaughtBy = taughtBy ? parseInt(taughtBy) : null;

      if (req.dbUser.role === "teacher") {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.id, parsedClassId), eq(classes.isDeleted, false)));
        if (allowed.length === 0) return res.status(403).json({ error: "Bạn không phụ trách lớp này" });
      } else if (req.dbUser.role !== "admin" && req.dbUser.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parsedClassId), eq(classes.isDeleted, false)));
        if (allowed.length === 0) return res.status(403).json({ error: "Lớp này không thuộc chi nhánh của bạn" });
      }

      const sessionExpiry = new Date(Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
      const existingOpen = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.classId, parsedClassId), eq(attendanceSessions.tenantId, tenantId), isNull(attendanceSessions.closedAt), gte(attendanceSessions.openedAt, sessionExpiry))).limit(1);

      if (existingOpen.length > 0) return res.json(existingOpen[0]);

      const result = await insertReturning(db, attendanceSessions, { tenantId, classId: parsedClassId, openedBy: req.dbUser.id, taughtBy: parsedTaughtBy });
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to open attendance session" });
    }
  });

  // Ghi nhận buổi dạy cho lớp KHÔNG dùng camera (điểm danh tay).
  app.post("/api/attendance-sessions/manual", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(403).json({ error: "Không xác định được người dùng" });
      const tenantId = req.dbUser.tenantId || req.user!.uid;
      const { classId, date, taughtBy } = req.body;

      if (!classId || isNaN(parseInt(classId))) return res.status(400).json({ error: "classId là bắt buộc" });
      const parsedClassId = parseInt(classId);
      const parsedTaughtBy = taughtBy ? parseInt(taughtBy) : null;

      const sessionDate = date ? new Date(date as string) : new Date();
      if (isNaN(sessionDate.getTime())) return res.status(400).json({ error: "Ngày không hợp lệ" });

      if (!(await canManageClass(req, tenantId, parsedClassId))) {
        return res.status(403).json({ error: "Bạn không có quyền ghi nhận buổi dạy cho lớp này" });
      }

      const startOfDay = new Date(sessionDate); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(sessionDate); endOfDay.setHours(23, 59, 59, 999);

      const existing = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.tenantId, tenantId), eq(attendanceSessions.classId, parsedClassId), gte(attendanceSessions.openedAt, startOfDay), lte(attendanceSessions.openedAt, endOfDay))).limit(1);

      if (existing.length > 0) {
        if (!existing[0].taughtBy && parsedTaughtBy) {
          const updated = await updateReturning(db, attendanceSessions, { taughtBy: parsedTaughtBy }, eq(attendanceSessions.id, existing[0].id));
          return res.json(updated[0] ?? existing[0]);
        }
        return res.json(existing[0]);
      }

      const now = new Date();
      const result = await insertReturning(db, attendanceSessions, { tenantId, classId: parsedClassId, openedBy: req.dbUser.id, taughtBy: parsedTaughtBy, openedAt: sessionDate, closedAt: now });
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to record teaching session" });
    }
  });

  app.put("/api/attendance-sessions/:id/close", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(403).json({ error: "Không xác định được người dùng" });
      const tenantId = req.dbUser.tenantId || req.user!.uid;
      const sessionId = parseInt(req.params.id);

      const existing = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.tenantId, tenantId))).limit(1);
      if (existing.length === 0) return res.status(404).json({ error: "Không tìm thấy phiên điểm danh" });
      const session = existing[0];

      if (req.dbUser.role === "teacher") {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, session.classId), eq(classes.teacherId, req.dbUser.id)));
        if (allowed.length === 0) return res.status(403).json({ error: "Bạn không phụ trách lớp này" });
      } else if (req.dbUser.role !== "admin" && req.dbUser.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, session.classId), eq(classes.branchId, req.dbUser.branchId)));
        if (allowed.length === 0) return res.status(403).json({ error: "Lớp này không thuộc chi nhánh của bạn" });
      }

      const result = await updateReturning(db, attendanceSessions, { closedAt: new Date() }, and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.tenantId, tenantId), isNull(attendanceSessions.closedAt)));
      res.json(result[0] || session);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to close attendance session" });
    }
  });
}
