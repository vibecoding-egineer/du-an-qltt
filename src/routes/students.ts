import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import {
  students,
  classes,
  classEnrollments,
  attendance,
} from "../db/schema.js";
import { eq, and, or, like, gte, lte, inArray, sql } from "drizzle-orm";

export function registerStudentRoutes(app: Express): void {
  app.get("/api/students", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId, startDate, endDate } = req.query;

      let allowedClassIds: number[] | null = null;
      if (req.dbUser?.role === "teacher") {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id)));
        allowedClassIds = allowedClasses.map((c) => c.id);
        if (allowedClassIds.length === 0) return res.json([]);
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId)));
        allowedClassIds = allowedClasses.map((c) => c.id);
        if (allowedClassIds.length === 0) return res.json([]);
      }

      const conditions = [eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.isDeleted, false), eq(students.isDeleted, false)];
      if (classId) conditions.push(eq(classEnrollments.classId, parseInt(classId as string)));
      if (allowedClassIds) conditions.push(inArray(classEnrollments.classId, allowedClassIds));

      const rawResult = await db
        .select({ student: students, enrollment: classEnrollments })
        .from(classEnrollments)
        .innerJoin(students, eq(classEnrollments.studentId, students.id))
        .where(and(...conditions));

      const result = rawResult.map((row) => ({
        ...row.student,
        classId: row.enrollment.classId,
        tuitionStatus: row.enrollment.tuitionStatus,
        tuitionOwed: row.enrollment.tuitionOwed,
        tuitionFee: row.enrollment.tuitionFee,
        entryLevel: row.enrollment.entryLevel,
        enrollmentDate: row.enrollment.enrollmentDate,
        enrollmentId: row.enrollment.id,
      }));

      let filterStartDate = new Date();
      let filterEndDate = new Date();

      if (startDate && endDate) {
        filterStartDate = new Date(startDate as string);
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate = new Date(endDate as string);
        filterEndDate.setHours(23, 59, 59, 999);
      } else {
        filterStartDate.setDate(1);
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate.setMonth(filterEndDate.getMonth() + 1);
        filterEndDate.setDate(0);
        filterEndDate.setHours(23, 59, 59, 999);
      }

      const studentIds = result.map((s: any) => s.id);

      let attendanceCounts: Record<number, number> = {};
      if (studentIds.length > 0) {
        const attendanceRecords = await db
          .select({
            studentId: attendance.studentId,
            count: sql`count(${attendance.id})`.mapWith(Number),
          })
          .from(attendance)
          .where(
            and(
              eq(attendance.tenantId, tenantId),
              eq(attendance.isDeleted, false),
              inArray(attendance.studentId, studentIds),
              eq(attendance.status, "present"),
              gte(attendance.date, filterStartDate),
              lte(attendance.date, filterEndDate),
            ),
          )
          .groupBy(attendance.studentId);

        attendanceRecords.forEach((record) => {
          if (record.studentId) attendanceCounts[record.studentId] = record.count;
        });
      }

      const mappedResult = result.map((student: any) => ({
        ...student,
        attendedSessionsCount: attendanceCounts[student.id] || 0,
      }));

      res.json(mappedResult);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // Tìm nhanh học viên theo tên hoặc mã
  app.get("/api/students/search", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";

      if (rawQuery.length < 2) return res.json([]);

      const pattern = `%${rawQuery}%`;
      const upperPattern = `%${rawQuery.toUpperCase()}%`;

      const result = await db
        .select({
          id: students.id,
          name: students.name,
          studentCode: students.studentCode,
          hanetPersonId: students.hanetPersonId,
        })
        .from(students)
        .where(
          and(
            eq(students.tenantId, tenantId),
            eq(students.isDeleted, false),
            or(
              like(students.name, pattern),
              like(students.studentCode, pattern),
              like(students.studentCode, upperPattern),
            ),
          ),
        )
        .orderBy(students.name)
        .limit(20);

      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to search students" });
    }
  });

  app.post("/api/students", requireAuth, requireRole(["admin", "manager", "staff"]), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, studentCode, phone, classId, tuitionStatus, tuitionOwed, dob, gender, entryLevel, enrollmentDate, tuitionFee, parentName, parentPhone, address, note } = req.body;

      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
          return res.status(403).json({ error: "Forbidden: Cannot add student to this class" });
        }
      }

      let student = null;
      if (studentCode) {
        const existing = await db.select().from(students).where(and(eq(students.tenantId, tenantId), eq(students.studentCode, studentCode), eq(students.isDeleted, false)));
        if (existing.length > 0) student = existing[0];
      }

      if (!student) {
        const insertRes = await insertReturning(db, students, {
          tenantId,
          name,
          studentCode: studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          phone,
          dob: dob ? new Date(dob) : null,
          gender: gender || null,
          parentName: parentName || null,
          parentPhone: parentPhone || null,
          address: address || null,
          note: note || null,
        });
        student = insertRes ?? null;
      }

      if (!student) {
        return res.status(500).json({ error: "Failed to create student" });
      }

      const enrollmentRes = await insertReturning(db, classEnrollments, {
        tenantId,
        studentId: student.id,
        classId: parseInt(classId),
        tuitionStatus: (req.dbUser?.role === "admin" || req.dbUser?.role === "manager") ? (tuitionStatus || "Chưa đóng") : "Chưa đóng",
        tuitionOwed: (tuitionStatus === "Còn thiếu" && tuitionOwed) ? parseInt(tuitionOwed) : 0,
        tuitionFee: tuitionFee ? parseInt(tuitionFee) : null,
        entryLevel: entryLevel || null,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null,
      });

      res.json({ ...student, classId: enrollmentRes?.classId, tuitionStatus: enrollmentRes?.tuitionStatus, tuitionOwed: enrollmentRes?.tuitionOwed });
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to create student" });
    }
  });

  app.post("/api/students/bulk", requireAuth, requireRole(["admin", "manager", "staff"]), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId, studentsData } = req.body;

      if (!classId || !studentsData || studentsData.length === 0) {
        return res.status(400).json({ error: "Invalid data" });
      }

      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const incomingCodes: string[] = studentsData
        .map((s: any) => s.studentCode)
        .filter((code: any): code is string => !!code);

      if (incomingCodes.length > 0) {
        const existingCodes = await db.select({ studentCode: students.studentCode }).from(students).where(and(eq(students.tenantId, tenantId), eq(students.isDeleted, false), inArray(students.studentCode, incomingCodes)));
        if (existingCodes.length > 0) {
          return res.status(400).json({ error: "Một số mã học viên đã tồn tại trong hệ thống, vui lòng kiểm tra lại file.", duplicateCodes: existingCodes.map((c) => c.studentCode) });
        }

        const seenCodes = new Set<string>();
        const duplicatesInFile = new Set<string>();
        for (const code of incomingCodes) {
          if (seenCodes.has(code)) duplicatesInFile.add(code);
          seenCodes.add(code);
        }
        if (duplicatesInFile.size > 0) {
          return res.status(400).json({ error: "File có mã học viên bị trùng lặp, vui lòng kiểm tra lại.", duplicateCodes: Array.from(duplicatesInFile) });
        }
      }

      const parseDate = (dateStr: any) => {
        if (!dateStr) return null;
        if (typeof dateStr === "number") return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        if (typeof dateStr === "string") {
          const parts = dateStr.split(/[-/]/);
          if (parts.length === 3) {
            const parsed = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(parsed.getTime())) return parsed;
          }
        }
        return null;
      };

      const parseMoney = (money: any) => {
        if (!money) return null;
        if (typeof money === "number") return money;
        const clean = String(money).replace(/\D/g, "");
        return clean ? parseInt(clean) : null;
      };

      const parsedClassId = parseInt(classId);

      const studentRows = studentsData.map((s: any) => ({
        tenantId,
        name: s.name,
        studentCode: s.studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        phone: s.phone || null,
        dob: parseDate(s.dob),
        gender: s.gender || null,
        parentName: s.parentName || null,
        parentPhone: s.parentPhone || null,
        address: s.address || null,
        note: s.note || null,
      }));

      interface BulkEnrollmentInfo {
        entryLevel: string | null;
        enrollmentDate: Date | null;
        tuitionFee: number | null;
      }
      const enrollmentByCode = new Map<string, BulkEnrollmentInfo>();
      studentsData.forEach((s: any, idx: number) => {
        enrollmentByCode.set(studentRows[idx].studentCode, {
          entryLevel: s.entryLevel || null,
          enrollmentDate: parseDate(s.enrollmentDate),
          tuitionFee: parseMoney(s.tuitionFee),
        });
      });

      const insertedCodes: string[] = studentRows.map((v: { studentCode: string }) => v.studentCode);

      const created = await db.transaction(async (tx) => {
        await tx.insert(students).values(studentRows);

        const insertedStudents = await tx.select().from(students).where(and(eq(students.tenantId, tenantId), eq(students.isDeleted, false), inArray(students.studentCode, insertedCodes)));

        await tx.insert(classEnrollments).values(
          insertedStudents.map((st) => {
            const info = enrollmentByCode.get(st.studentCode);
            return {
              tenantId,
              studentId: st.id,
              classId: parsedClassId,
              tuitionStatus: "Chưa đóng",
              tuitionOwed: 0,
              tuitionFee: info?.tuitionFee ?? null,
              entryLevel: info?.entryLevel ?? null,
              enrollmentDate: info?.enrollmentDate ?? null,
            };
          }),
        );

        return insertedStudents.map((st) => {
          const info = enrollmentByCode.get(st.studentCode);
          return { ...st, classId: parsedClassId, tuitionStatus: "Chưa đóng", tuitionOwed: 0, tuitionFee: info?.tuitionFee ?? null, entryLevel: info?.entryLevel ?? null, enrollmentDate: info?.enrollmentDate ?? null };
        });
      });

      res.json(created);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Bulk insert failed" });
    }
  });

  app.put("/api/students/:id", requireAuth, requireRole(["admin", "manager", "staff"]), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { id } = req.params;
      const { name, phone, classId, tuitionStatus, tuitionOwed } = req.body;

      const result = await updateReturning(db, students, { name, phone }, and(eq(students.id, parseInt(id)), eq(students.tenantId, tenantId), eq(students.isDeleted, false)));

      if (classId) {
        await db
          .update(classEnrollments)
          .set({
            ...((tuitionStatus && (req.dbUser?.role === "admin" || req.dbUser?.role === "manager")) && { tuitionStatus }),
            ...((req.dbUser?.role === "admin" || req.dbUser?.role === "manager") && { tuitionOwed: (tuitionStatus === "Còn thiếu" && tuitionOwed) ? parseInt(tuitionOwed) : 0 }),
          })
          .where(and(eq(classEnrollments.studentId, parseInt(id)), eq(classEnrollments.classId, parseInt(classId)), eq(classEnrollments.isDeleted, false)));
      }
      res.json(result[0]);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to update student" });
    }
  });

  // Gỡ liên kết khuôn mặt Hanet
  app.delete("/api/students/:id/hanet-link", requireAuth, requireRole(["admin", "manager", "staff"]), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const studentId = parseInt(req.params.id);

      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classEnrollments.id }).from(classEnrollments).innerJoin(classes, eq(classEnrollments.classId, classes.id)).where(and(eq(classEnrollments.studentId, studentId), eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.isDeleted, false), eq(classes.branchId, req.dbUser.branchId))).limit(1);
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Bạn không có quyền thao tác với học viên ngoài chi nhánh mình." });
        }
      }

      const result = await updateReturning(db, students, { hanetPersonId: null }, and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false)));

      if (result.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy học viên" });
      }
      res.json({ success: true, student: result[0] });
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to unlink Hanet face" });
    }
  });

  app.delete("/api/students/:id", requireAuth, requireRole(["admin", "manager", "staff"]), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const studentId = parseInt(req.params.id);
      const { classId } = req.query;

      await db.transaction(async (tx) => {
        if (classId) {
          const parsedClassId = parseInt(classId as string);
          await tx.update(classEnrollments).set({ isDeleted: true, deletedAt: new Date() }).where(and(eq(classEnrollments.studentId, studentId), eq(classEnrollments.classId, parsedClassId), eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.isDeleted, false)));
          await tx.update(attendance).set({ isDeleted: true, deletedAt: new Date() }).where(and(eq(attendance.studentId, studentId), eq(attendance.classId, parsedClassId), eq(attendance.tenantId, tenantId), eq(attendance.isDeleted, false)));
        } else {
          await tx.update(attendance).set({ isDeleted: true, deletedAt: new Date() }).where(and(eq(attendance.studentId, studentId), eq(attendance.tenantId, tenantId), eq(attendance.isDeleted, false)));
          await tx.update(classEnrollments).set({ isDeleted: true, deletedAt: new Date() }).where(and(eq(classEnrollments.studentId, studentId), eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.isDeleted, false)));
          await tx.update(students).set({ isDeleted: true, deletedAt: new Date() }).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false)));
        }
      });

      res.json({ success: true });
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete student" });
    }
  });
}
