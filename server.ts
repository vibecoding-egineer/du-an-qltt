import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, type AuthRequest } from "./src/middleware/auth.js";
import { getOrCreateUser } from "./src/db/users.js";
import { db } from "./src/db/index.js";
import { branches, classes, students, users, attendance, settings, transactions, promotions, classEnrollments } from "./src/db/schema.js";
import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";
import { getAuth } from "firebase-admin/auth";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth synchronization route
  app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const dbUser = await getOrCreateUser(user.uid, user.email || '', user.name);
      res.json(dbUser);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Onboarding API
  app.post("/api/onboarding/create-tenant", async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const authReq = req as any;
      
      // Need to verify token manually here because requireAuth middleware expects a full user in DB
      let decodedToken;
      try {
         
         decodedToken = await getAuth().verifyIdToken(token);
      } catch (e) {
         return res.status(401).json({ error: "Invalid token" });
      }
      
      const { uid, email, name } = decodedToken;
      const tenantId = uid; // Admin's uid becomes tenantId

      const result = await db.insert(users)
        .values({
          uid,
          email: email || '',
          name: name || null,
          tenantId,
          role: 'admin',
        })
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create center" });
    }
  });

  app.post("/api/onboarding/join-tenant", async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split('Bearer ')[1];
      
      let decodedToken;
      try {
         
         decodedToken = await getAuth().verifyIdToken(token);
      } catch (e) {
         return res.status(401).json({ error: "Invalid token" });
      }

      const { inviteCode } = req.body;
      const { uid, email, name } = decodedToken;

      // Look up user by invite code
      const existingInvite = await db.select().from(users).where(eq(users.inviteCode, inviteCode)).limit(1);

      if (existingInvite.length === 0) {
        return res.status(404).json({ error: "Mã lời mời không hợp lệ" });
      }

      const user = existingInvite[0];
      
      // Update the user record with real uid and clear invite code
      const result = await db.update(users)
        .set({ uid, name: name || user.name || null, inviteCode: null })
        .where(eq(users.id, user.id))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to join center" });
    }
  });

  // Users API
  app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let query = db.select().from(users).where(eq(users.tenantId, tenantId)) as any;
      if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        query = db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.branchId, req.dbUser.branchId))) as any;
      }
      const result = await query;
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const adminCheck = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
        return res.status(403).json({ error: "Chỉ quản trị viên mới được phép thực hiện" });
      }

      const { email, name, role, employeeCode, branchId, permissions } = req.body;
      
      // Check if user already exists across the whole system
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống." });
      }

      const pendingUid = `pending_${Date.now()}_${email}`;
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const result = await db.insert(users).values({
        uid: pendingUid,
        email,
        name: name || null,
        role: role || 'staff',
        employeeCode: employeeCode || null,
        branchId: branchId ? parseInt(branchId) : null,
        permissions: permissions || [],
        inviteCode,
        tenantId
      }).returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      // Basic authorization - check if requesting user is an admin
      const adminCheck = await db.select().from(users).where(eq(users.uid, req.user!.uid));
      if (!adminCheck[0] || adminCheck[0].role !== 'admin') {
        return res.status(403).json({ error: "Chỉ quản trị viên mới được phép thực hiện" });
      }

      const { id } = req.params;
      const { role, permissions } = req.body;

      // Ensure target user is in same tenant (done by where clause on tenantId)
      const result = await db.update(users)
        .set({ 
          ...(role && { role }),
          ...(permissions && { permissions })
         })
        .where(and(eq(users.id, parseInt(id)), eq(users.tenantId, tenantId)))
        .returning();
      
      if (!result.length) {
        return res.status(404).json({ error: "User not found or unauthorized" });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Settings API
  app.get("/api/settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let result = await db.select().from(settings).where(eq(settings.tenantId, tenantId)).limit(1);
      
      if (result.length === 0) {
        // Create default settings
        const newSettings = await db.insert(settings).values({
          tenantId,
          centerName: 'Eduspace',
          logoUrl: null
        }).returning();
        return res.json(newSettings[0]);
      }
      
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      
      // Ensure only admins can update settings
      if (req.dbUser?.role && req.dbUser.role !== 'admin') {
        return res.status(403).json({ error: "Only admins can update settings" });
      }
      
      const { centerName, logoUrl } = req.body;
      
      let result = await db.select().from(settings).where(eq(settings.tenantId, tenantId)).limit(1);
      
      if (result.length === 0) {
        const newSettings = await db.insert(settings).values({
          tenantId,
          centerName,
          logoUrl
        }).returning();
        return res.json(newSettings[0]);
      } else {
        const updatedSettings = await db.update(settings)
          .set({ centerName, logoUrl, updatedAt: new Date() })
          .where(eq(settings.tenantId, tenantId))
          .returning();
        return res.json(updatedSettings[0]);
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Branches API
  app.get("/api/branches", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      
      let query = db.select().from(branches).where(eq(branches.tenantId, tenantId)) as any;
      if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        query = db.select().from(branches).where(and(eq(branches.tenantId, tenantId), eq(branches.id, req.dbUser.branchId))) as any;
      }
      const result = await query;
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.post("/api/branches", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, code, phone, address } = req.body;
      const result = await db.insert(branches).values({ tenantId, name, code, phone, address }).returning();
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create branch" });
    }
  });

  app.put("/api/branches/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, code, phone, address } = req.body;
      const branchId = parseInt(req.params.id);
      
      const result = await db.update(branches)
        .set({ name, code, phone, address })
        .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)))
        .returning();
        
      if (result.length === 0) {
        return res.status(404).json({ error: "Branch not found or unauthorized" });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  // Classes API
  app.get("/api/classes", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      
      let query = db.select().from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.isDeleted, false))) as any;
      if (req.dbUser?.role === 'teacher') {
         query = db.select().from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.isDeleted, false), eq(classes.teacherId, req.dbUser.id))) as any;
      } else if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        query = db.select().from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.isDeleted, false), eq(classes.branchId, req.dbUser.branchId))) as any;
      }
      const classesData = await query;
      const allEnrollments = await db.select({ classId: classEnrollments.classId }).from(classEnrollments).where(and(eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.isDeleted, false)));
      
      const result = classesData.map((c: any) => {
         const studentCount = allEnrollments.filter(s => s.classId === c.id).length;
         return { ...c, studentCount };
      });
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch classes" });
    }
  });

  app.post("/api/classes", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot create classes." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let { branchId, name, program, tuition, teacherId, sessionsPerMonth, feeMethod } = req.body;
      
      // If user is not admin, force their branchId
      if (req.dbUser?.role !== 'admin') {
        if (!req.dbUser?.branchId) {
          return res.status(403).json({ error: "You must be assigned to a branch to create classes." });
        }
        branchId = req.dbUser.branchId;
      }

      const result = await db.insert(classes).values({ 
        tenantId, 
        branchId: parseInt(branchId), 
        teacherId: teacherId ? parseInt(teacherId) : null,
        name, 
        program, 
        tuition: tuition ? parseInt(tuition) : null,
        sessionsPerMonth: sessionsPerMonth ? parseInt(sessionsPerMonth) : null,
        feeMethod: feeMethod || 'per_session'
      }).returning();
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create class" });
    }
  });

  app.put("/api/classes/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot edit classes." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { id } = req.params;
      let { branchId, name, program, tuition, teacherId, sessionsPerMonth, feeMethod } = req.body;
      
      if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        // Ensure they only edit classes in their branch
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(id)), eq(classes.isDeleted, false)));
        if (allowed.length === 0) {
           return res.status(403).json({ error: "Forbidden: Cannot edit class in this branch" });
        }
        branchId = req.dbUser.branchId;
      }
      
      const result = await db.update(classes)
        .set({
          branchId: parseInt(branchId), 
          teacherId: teacherId ? parseInt(teacherId) : null,
          name, 
          program, 
          tuition: tuition ? parseInt(tuition) : null,
          sessionsPerMonth: sessionsPerMonth ? parseInt(sessionsPerMonth) : null,
          feeMethod: feeMethod || 'per_session'
        })
        .where(and(eq(classes.id, parseInt(id)), eq(classes.tenantId, tenantId), eq(classes.isDeleted, false)))
        .returning();
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update class" });
    }
  });

  app.delete("/api/classes/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot delete classes." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { id } = req.params;
      const classId = parseInt(id);
      
      if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, classId), eq(classes.isDeleted, false)));
        if (allowed.length === 0) {
           return res.status(403).json({ error: "Forbidden: Cannot delete class in this branch" });
        }
      }
      
      // Check if class has students (chỉ tính các ghi danh đang hoạt động, chưa bị xóa mềm)
      const classStudents = await db.select({ id: classEnrollments.id }).from(classEnrollments).where(and(eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.classId, classId), eq(classEnrollments.isDeleted, false))).limit(1);
      if (classStudents.length > 0) {
        return res.status(400).json({ error: "Không thể xóa lớp học vì đã có học viên đăng ký." });
      }

      // Soft delete: giữ lại toàn bộ dữ liệu lịch sử của lớp, chỉ đánh dấu đã xóa
      const result = await db.update(classes)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(and(eq(classes.id, classId), eq(classes.tenantId, tenantId), eq(classes.isDeleted, false)))
        .returning();
      res.json(result[0] || { success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete class" });
    }
  });

  const updateFaceHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { id } = req.params;
      const { faceDescriptor } = req.body;
      
      const result = await db.update(students)
        .set({ faceDescriptor: JSON.stringify(faceDescriptor) })
        .where(and(eq(students.id, parseInt(id)), eq(students.tenantId, tenantId), eq(students.isDeleted, false)))
        .returning();
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update face descriptor" });
    }
  };

  app.put("/api/students/:id/face", requireAuth, updateFaceHandler);
  app.post("/api/students/:id/face", requireAuth, updateFaceHandler);

  // Students API
  app.get("/api/students", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId, startDate, endDate } = req.query;
      
      let allowedClassIds: number[] | null = null;
      if (req.dbUser?.role === 'teacher') {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id)));
        allowedClassIds = allowedClasses.map(c => c.id);
        if (allowedClassIds.length === 0) {
          return res.json([]);
        }
      } else if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId)));
        allowedClassIds = allowedClasses.map(c => c.id);
        if (allowedClassIds.length === 0) {
          return res.json([]);
        }
      }

      const conditions = [eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.isDeleted, false), eq(students.isDeleted, false)];
      if (classId) {
        conditions.push(eq(classEnrollments.classId, parseInt(classId as string)));
      }
      if (allowedClassIds) {
        conditions.push(inArray(classEnrollments.classId, allowedClassIds));
      }

      const rawResult = await db.select({
        student: students,
        enrollment: classEnrollments
      })
      .from(classEnrollments)
      .innerJoin(students, eq(classEnrollments.studentId, students.id))
      .where(and(...conditions));

      const result = rawResult.map(row => ({
        ...row.student,
        classId: row.enrollment.classId,
        tuitionStatus: row.enrollment.tuitionStatus,
        tuitionOwed: row.enrollment.tuitionOwed,
        tuitionFee: row.enrollment.tuitionFee,
        entryLevel: row.enrollment.entryLevel,
        enrollmentDate: row.enrollment.enrollmentDate,
        enrollmentId: row.enrollment.id
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
        const attendanceRecords = await db.select({
          studentId: attendance.studentId,
          count: sql`count(${attendance.id})`.mapWith(Number)
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.tenantId, tenantId),
            eq(attendance.isDeleted, false),
            inArray(attendance.studentId, studentIds),
            eq(attendance.status, 'present'),
            gte(attendance.date, filterStartDate),
            lte(attendance.date, filterEndDate)
          )
        )
        .groupBy(attendance.studentId);
        
        attendanceRecords.forEach(record => {
          if (record.studentId) attendanceCounts[record.studentId] = record.count;
        });
      }

      const mappedResult = result.map((student: any) => ({
        ...student,
        attendedSessionsCount: attendanceCounts[student.id] || 0
      }));
      
      res.json(mappedResult);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.post("/api/students", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot register students." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { 
        name, studentCode, phone, classId, tuitionStatus, tuitionOwed,
        dob, gender, entryLevel, enrollmentDate, tuitionFee, parentName, parentPhone, address, note
      } = req.body;

      // Authorization check
      if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
           return res.status(403).json({ error: "Forbidden: Cannot add student to this class" });
        }
      }

      // Try to find if student code exists (chỉ tính học viên đang hoạt động, chưa xóa mềm)
      let student = null;
      if (studentCode) {
         const existing = await db.select().from(students).where(and(eq(students.tenantId, tenantId), eq(students.studentCode, studentCode), eq(students.isDeleted, false)));
         if (existing.length > 0) student = existing[0];
      }
      
      if (!student) {
        const insertRes = await db.insert(students).values({
          tenantId,
          name,
          studentCode: studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          phone,
          dob: dob ? new Date(dob) : null,
          gender: gender || null,
          parentName: parentName || null,
          parentPhone: parentPhone || null,
          address: address || null,
          note: note || null
        }).returning();
        student = insertRes[0];
      }

      const enrollmentRes = await db.insert(classEnrollments).values({
        tenantId,
        studentId: student.id,
        classId: parseInt(classId),
        tuitionStatus: (req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager') ? (tuitionStatus || 'Chưa đóng') : 'Chưa đóng',
        tuitionOwed: (tuitionStatus === 'Còn thiếu' && tuitionOwed) ? parseInt(tuitionOwed) : 0,
        tuitionFee: tuitionFee ? parseInt(tuitionFee) : null,
        entryLevel: entryLevel || null,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null,
      }).returning();

      res.json({ ...student, classId: enrollmentRes[0].classId, tuitionStatus: enrollmentRes[0].tuitionStatus, tuitionOwed: enrollmentRes[0].tuitionOwed });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create student" });
    }
  });

  app.post("/api/students/bulk", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot register students." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId, studentsData } = req.body;

      if (!classId || !studentsData || studentsData.length === 0) {
        return res.status(400).json({ error: "Invalid data" });
      }

      if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
           return res.status(403).json({ error: "Forbidden" });
        }
      }

      // Chống trùng mã học viên khi nhập hàng loạt (ví dụ: import file Excel 2 lần)
      const incomingCodes: string[] = studentsData
        .map((s: any) => s.studentCode)
        .filter((code: any): code is string => !!code);

      if (incomingCodes.length > 0) {
        // 1. Trùng với học viên đang hoạt động đã có trong hệ thống
        const existingCodes = await db.select({ studentCode: students.studentCode })
          .from(students)
          .where(and(
            eq(students.tenantId, tenantId),
            eq(students.isDeleted, false),
            inArray(students.studentCode, incomingCodes)
          ));

        if (existingCodes.length > 0) {
          return res.status(400).json({
            error: "Một số mã học viên đã tồn tại trong hệ thống, vui lòng kiểm tra lại file.",
            duplicateCodes: existingCodes.map(c => c.studentCode)
          });
        }

        // 2. Trùng lặp ngay trong chính file đang import
        const seenCodes = new Set<string>();
        const duplicatesInFile = new Set<string>();
        for (const code of incomingCodes) {
          if (seenCodes.has(code)) {
            duplicatesInFile.add(code);
          }
          seenCodes.add(code);
        }
        if (duplicatesInFile.size > 0) {
          return res.status(400).json({
            error: "File có mã học viên bị trùng lặp, vui lòng kiểm tra lại.",
            duplicateCodes: Array.from(duplicatesInFile)
          });
        }
      }

      const parseDate = (dateStr: any) => {
        if (!dateStr) return null;
        if (typeof dateStr === 'number') {
           // Excel serial date to JS Date
           return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        if (typeof dateStr === 'string') {
           const parts = dateStr.split(/[-/]/);
           if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2]);
              const parsed = new Date(year, month, day);
              if (!isNaN(parsed.getTime())) return parsed;
           }
        }
        return null;
      };

      const parseMoney = (money: any) => {
        if (!money) return null;
        if (typeof money === 'number') return money;
        const clean = String(money).replace(/\D/g, '');
        return clean ? parseInt(clean) : null;
      };

      const valuesToInsert = studentsData.map((s: any) => ({
        tenantId,
        classId: parseInt(classId),
        name: s.name,
        studentCode: s.studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        phone: s.phone || null,
        dob: parseDate(s.dob),
        gender: s.gender || null,
        entryLevel: s.entryLevel || null,
        enrollmentDate: parseDate(s.enrollmentDate),
        tuitionFee: parseMoney(s.tuitionFee),
        parentName: s.parentName || null,
        parentPhone: s.parentPhone || null,
        address: s.address || null,
        note: s.note || null,
        tuitionStatus: 'Chưa đóng',
        tuitionOwed: 0
      }));


      const result = await db.insert(students).values(valuesToInsert).returning();
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Bulk insert failed" });
    }
  });

  app.put("/api/students/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot edit students." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { id } = req.params;
      const { name, phone, classId, tuitionStatus, tuitionOwed } = req.body;
      
      const result = await db.update(students)
        .set({ name, phone })
        .where(and(eq(students.id, parseInt(id)), eq(students.tenantId, tenantId), eq(students.isDeleted, false)))
        .returning();
        
      if (classId) {
        await db.update(classEnrollments)
          .set({
             ...((tuitionStatus && (req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager')) && { tuitionStatus }),
             ...((req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager') && { tuitionOwed: (tuitionStatus === 'Còn thiếu' && tuitionOwed) ? parseInt(tuitionOwed) : 0 })
          })
          .where(and(eq(classEnrollments.studentId, parseInt(id)), eq(classEnrollments.classId, parseInt(classId)), eq(classEnrollments.isDeleted, false)));
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot delete students." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { id } = req.params;
      const studentId = parseInt(id);
      const { classId } = req.query;

      // Toàn bộ thao tác xóa được bọc trong 1 transaction: hoặc tất cả cùng thành công,
      // hoặc không có gì bị thay đổi nếu có bước nào lỗi giữa chừng.
      // Đồng thời chuyển từ xóa cứng (DELETE) sang xóa mềm (soft delete) để có thể khôi phục sau này.
      await db.transaction(async (tx) => {
        if (classId) {
          const parsedClassId = parseInt(classId as string);
          // Chỉ gỡ học viên khỏi 1 lớp cụ thể: xóa mềm ghi danh + điểm danh của riêng lớp đó,
          // LUÔN kèm điều kiện tenantId để tránh xóa nhầm dữ liệu của tenant khác.
          await tx.update(classEnrollments)
            .set({ isDeleted: true, deletedAt: new Date() })
            .where(and(
              eq(classEnrollments.studentId, studentId),
              eq(classEnrollments.classId, parsedClassId),
              eq(classEnrollments.tenantId, tenantId),
              eq(classEnrollments.isDeleted, false)
            ));

          await tx.update(attendance)
            .set({ isDeleted: true, deletedAt: new Date() })
            .where(and(
              eq(attendance.studentId, studentId),
              eq(attendance.classId, parsedClassId),
              eq(attendance.tenantId, tenantId),
              eq(attendance.isDeleted, false)
            ));
        } else {
          // Không truyền classId: xóa mềm toàn bộ dữ liệu của học viên trong tenant này
          await tx.update(attendance)
            .set({ isDeleted: true, deletedAt: new Date() })
            .where(and(eq(attendance.studentId, studentId), eq(attendance.tenantId, tenantId), eq(attendance.isDeleted, false)));

          await tx.update(classEnrollments)
            .set({ isDeleted: true, deletedAt: new Date() })
            .where(and(eq(classEnrollments.studentId, studentId), eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.isDeleted, false)));

          await tx.update(students)
            .set({ isDeleted: true, deletedAt: new Date() })
            .where(and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false)));
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete student" });
    }
  });

  // Attendance API
  app.get("/api/attendance", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId, date } = req.query;
      if (!classId || !date) {
        return res.status(400).json({ error: "classId and date are required" });
      }

      // Authorization check
      if (req.dbUser?.role === 'teacher') {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.id, parseInt(classId as string))));
        if (allowedClasses.length === 0) {
           return res.status(403).json({ error: "Forbidden access to this class" });
        }
      } else if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(classId as string))));
        if (allowedClasses.length === 0) {
           return res.status(403).json({ error: "Forbidden access to this class" });
        }
      }

      // Parse date to start and end of day
      const queryDate = new Date(date as string);
      const startOfDay = new Date(queryDate.setHours(0,0,0,0));
      const endOfDay = new Date(queryDate.setHours(23,59,59,999));
      
      const result = await db.select().from(attendance)
        .where(
          and(
            eq(attendance.tenantId, tenantId),
            eq(attendance.isDeleted, false),
            eq(attendance.classId, parseInt(classId as string)),
            gte(attendance.date, startOfDay),
            lte(attendance.date, endOfDay)
          )
        );
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { studentId, classId, date, status, homeworkCompleted, note } = req.body;


      // Authorization check
      if (req.dbUser?.role === 'teacher') {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
           return res.status(403).json({ error: "Forbidden access to this class" });
        }
      } else if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
           return res.status(403).json({ error: "Forbidden access to this class" });
        }
      }

      // Upsert logic for attendance: xóa mềm bản ghi cũ trong cùng ngày (nếu có) rồi ghi bản ghi mới,
      // toàn bộ nằm trong 1 transaction để không bao giờ mất điểm danh cũ mà không có bản ghi mới thay thế.
      const queryDate = new Date(date as string);
      const startOfDay = new Date(queryDate.setHours(0,0,0,0));
      const endOfDay = new Date(queryDate.setHours(23,59,59,999));

      const result = await db.transaction(async (tx) => {
        await tx.update(attendance)
          .set({ isDeleted: true, deletedAt: new Date() })
          .where(and(
             eq(attendance.tenantId, tenantId),
             eq(attendance.studentId, parseInt(studentId)),
             eq(attendance.classId, parseInt(classId)),
             eq(attendance.isDeleted, false),
             gte(attendance.date, startOfDay),
             lte(attendance.date, endOfDay)
          ));

        return await tx.insert(attendance).values({
          tenantId,
          studentId: parseInt(studentId),
          classId: parseInt(classId),
          date: new Date(date),
          status,
          homeworkCompleted: homeworkCompleted ? 1 : 0,
          note
        }).returning();
      });

      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to mark attendance" });
    }
  });

  // Mock Real-time Inventory API
  app.get("/api/inventory", (req, res) => {
    res.json({
      items: [
        { id: "HH01", name: "Giáo trình Tiếng Anh cơ bản", stock: 150, branch: "Cơ sở 1" },
        { id: "HH02", name: "Máy chiếu", stock: 5, branch: "Cơ sở 1" },
        { id: "HH03", name: "Bút lông", stock: 200, branch: "Cơ sở 2" },
      ]
    });
  });

  // Transactions API
  app.get("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { branchId, type, category, startDate, endDate } = req.query;
      
      let conditions = [eq(transactions.tenantId, tenantId), eq(transactions.isDeleted, false)];
      
      if (branchId) conditions.push(eq(transactions.branchId, parseInt(branchId as string)));
      if (type) conditions.push(eq(transactions.type, type as string));
      if (category) conditions.push(eq(transactions.category, category as string));
      
      if (startDate && endDate) {
        conditions.push(gte(transactions.date, new Date(startDate as string)));
        conditions.push(lte(transactions.date, new Date(endDate as string)));
      }
      
      const data = await db.select({
        id: transactions.id,
        type: transactions.type,
        category: transactions.category,
        amount: transactions.amount,
        date: transactions.date,
        note: transactions.note,
        studentId: transactions.studentId,
        studentName: students.name,
      })
      .from(transactions)
      .leftJoin(students, eq(transactions.studentId, students.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.date));
      
      res.json(data);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot create transactions." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let { branchId, type, category, amount, date, note, studentId } = req.body;
      
      if (req.dbUser?.role !== 'admin') {
        if (!req.dbUser?.branchId) {
          return res.status(403).json({ error: "You must be assigned to a branch to create transactions." });
        }
        branchId = req.dbUser.branchId;
      }
      
      const result = await db.insert(transactions).values({
        tenantId,
        branchId: branchId ? parseInt(branchId) : null,
        type,
        category,
        amount: parseInt(amount),
        date: date ? new Date(date) : new Date(),
        note,
        studentId: studentId ? parseInt(studentId) : null,
      }).returning();
      
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  app.delete("/api/transactions/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.dbUser?.role === 'teacher') {
         return res.status(403).json({ error: "Teachers cannot delete transactions." });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      
      const result = await db.update(transactions)
        .set({ isDeleted: true, deletedAt: new Date() })
        .where(and(eq(transactions.id, parseInt(req.params.id)), eq(transactions.tenantId, tenantId), eq(transactions.isDeleted, false)))
        .returning();
      
      res.json(result[0] || { success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // Vite middleware for development
  // --- PROMOTIONS API ---
  app.get("/api/promotions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const result = await db.select().from(promotions).where(and(eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false))).orderBy(desc(promotions.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Lỗi lấy danh sách ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  app.post("/api/promotions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const isAdmin = req.dbUser?.role === 'admin';
      const hasPromoPerm = req.dbUser?.permissions?.includes('/promotions');
      if (!isAdmin && !hasPromoPerm) {
        return res.status(403).json({ error: "Không có quyền" });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, discountType, discountValue, branchIds, startDate, endDate, isActive } = req.body;

      if (discountType === 'percentage' && discountValue > 100) {
        return res.status(400).json({ error: "Phần trăm giảm giá không được vượt quá 100" });
      }

      const [newPromo] = await db.insert(promotions).values({
        tenantId,
        name,
        discountType,
        discountValue,
        branchIds,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : true
      }).returning();
      
      res.json(newPromo);
    } catch (error) {
      console.error("Lỗi tạo ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  app.put("/api/promotions/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const isAdmin = req.dbUser?.role === 'admin';
      const hasPromoPerm = req.dbUser?.permissions?.includes('/promotions');
      if (!isAdmin && !hasPromoPerm) {
        return res.status(403).json({ error: "Không có quyền" });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const promoId = parseInt(req.params.id);
      const { name, discountType, discountValue, branchIds, startDate, endDate, isActive } = req.body;

      if (discountType === 'percentage' && discountValue > 100) {
        return res.status(400).json({ error: "Phần trăm giảm giá không được vượt quá 100" });
      }

      const [updatedPromo] = await db.update(promotions)
        .set({
          name,
          discountType,
          discountValue,
          branchIds,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          isActive,
          updatedAt: new Date()
        })
        .where(and(eq(promotions.id, promoId), eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false)))
        .returning();

      if (!updatedPromo) {
        return res.status(404).json({ error: "Không tìm thấy ưu đãi" });
      }
      res.json(updatedPromo);
    } catch (error) {
      console.error("Lỗi cập nhật ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  app.delete("/api/promotions/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const isAdmin = req.dbUser?.role === 'admin';
      const hasPromoPerm = req.dbUser?.permissions?.includes('/promotions');
      if (!isAdmin && !hasPromoPerm) {
        return res.status(403).json({ error: "Không có quyền" });
      }
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const promoId = parseInt(req.params.id);

      await db.update(promotions)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(promotions.id, promoId), eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false)));
      res.json({ success: true });
    } catch (error) {
      console.error("Lỗi xóa ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();