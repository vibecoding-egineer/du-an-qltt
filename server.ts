import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, type AuthRequest } from "./src/middleware/auth.js";
import { requireRole, requirePermission } from "./src/middleware/rbac.js";
import { getOrCreateUser } from "./src/db/users.js";
import { db } from "./src/db/index.js";
import { insertReturning, updateReturning } from "./src/db/helpers.js";
import { branches, classes, students, users, attendance, settings, transactions, promotions, classEnrollments, attendanceSessions, hanetPendingCheckins, licenses, shifts, classSchedules, staffShifts, staffAttendance } from "./src/db/schema.js";
import { eq, and, or, like, desc, gte, lte, inArray, sql, isNull } from "drizzle-orm";
import { getAuth } from "firebase-admin/auth";
import { verifyHanetHash, parseHanetTime, HANET_RECOGNIZED_PERSON_TYPES, type HanetWebhookPayload } from "./src/lib/hanet.js";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

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

      // Bắt buộc phải có mã kích hoạt hợp lệ do chủ hệ thống cấp mới được tạo trung tâm mới.
      // Trước đây bất kỳ ai có tài khoản Firebase đều tự tạo được trung tâm và trở thành admin.
      const { licenseCode } = req.body;
      if (!licenseCode || typeof licenseCode !== 'string') {
        return res.status(400).json({ error: "Vui lòng nhập mã kích hoạt." });
      }

      const normalizedCode = licenseCode.trim().toUpperCase();
      const licenseRows = await db.select().from(licenses)
        .where(eq(licenses.code, normalizedCode))
        .limit(1);

      const license = licenseRows[0];
      if (!license) {
        return res.status(400).json({ error: "Mã kích hoạt không hợp lệ." });
      }
      if (license.isRevoked) {
        return res.status(400).json({ error: "Mã kích hoạt đã bị thu hồi." });
      }
      if (license.usedAt || license.tenantId) {
        return res.status(400).json({ error: "Mã kích hoạt này đã được sử dụng." });
      }
      if (license.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ error: "Mã kích hoạt đã hết hạn." });
      }

      // Tạo tài khoản admin và đánh dấu mã đã dùng trong CÙNG 1 transaction: tránh trường hợp
      // tạo được trung tâm nhưng mã vẫn còn trống (bị dùng lại), hoặc mã bị đánh dấu đã dùng
      // trong khi trung tâm chưa được tạo (khách mất mã oan).
      const result = await db.transaction(async (tx) => {
        const inserted = await insertReturning(tx, users, {
          uid,
          email: email || '',
          name: name || null,
          tenantId,
          role: 'admin',
        });

        // Điều kiện lặp lại "chưa dùng" ngay trong câu UPDATE để chặn tình huống 2 người
        // cùng dùng 1 mã tại đúng một thời điểm - chỉ 1 request thắng, request kia không
        // cập nhật được dòng nào.
        //
        // CỐ Ý KHÔNG dùng updateReturning ở đây: hàm đó đọc danh sách ID trước rồi mới cập
        // nhật, tức là tách thành 2 câu lệnh và LÀM MẤT tính nguyên tử. Với mã kích hoạt,
        // chính tính nguyên tử của một câu UPDATE duy nhất là thứ đang chặn 2 người cùng
        // chiếm một mã, nên ở đây giữ nguyên câu UPDATE và đọc số dòng bị ảnh hưởng.
        const [claimResult] = await tx.update(licenses)
          .set({ usedAt: new Date(), tenantId })
          .where(and(
            eq(licenses.id, license.id),
            isNull(licenses.usedAt),
            isNull(licenses.tenantId)
          ));

        if (claimResult.affectedRows === 0) {
          throw new Error('LICENSE_ALREADY_CLAIMED');
        }

        return inserted;
      });

      res.json(result);
    } catch (error: any) {
      if (error?.message === 'LICENSE_ALREADY_CLAIMED') {
        return res.status(400).json({ error: "Mã kích hoạt này vừa được sử dụng. Vui lòng kiểm tra lại." });
      }
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

      // Không cho nhân viên tham gia vào trung tâm đã hết hạn hoặc bị thu hồi giấy phép -
      // nếu bỏ qua bước này, họ vào được nhưng rồi mọi thao tác đều bị requireAuth chặn,
      // gây bối rối hơn là báo rõ ràng ngay từ đầu.
      const licenseRows = await db.select().from(licenses)
        .where(eq(licenses.tenantId, user.tenantId))
        .limit(1);
      const license = licenseRows[0];
      if (!license || license.isRevoked || license.expiresAt.getTime() < Date.now()) {
        return res.status(403).json({ error: "Trung tâm này hiện không hoạt động. Vui lòng liên hệ quản trị viên trung tâm." });
      }
      
      // Update the user record with real uid and clear invite code
      const result = await updateReturning(
        db,
        users,
        { uid, name: name || user.name || null, inviteCode: null },
        eq(users.id, user.id),
      );

      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to join center" });
    }
  });

  // ===== Webhook Hanet AI Camera =====
  // Route CÔNG KHAI - Hanet gọi trực tiếp từ camera/cloud của họ, KHÔNG có Firebase token nên
  // KHÔNG qua requireAuth. Bảo mật bằng cách tự tính lại hash = MD5(client_secret + id) và so
  // khớp với hash Hanet gửi kèm mỗi request. Sai hash bị từ chối ngay, không chạm tới DB.
  const HANET_SESSION_EXPIRY_HOURS = 3;

       app.post("/api/webhooks/hanet", async (req, res) => {
    try {
      const payload = req.body as HanetWebhookPayload;

      // Ghi nhận MỌI request Hanet gửi tới, kể cả các trường hợp bị bỏ qua.
      // Dùng console.error để nội dung đi vào stderr.log - console.log đi vào stdout,
      // là chỗ khó xem trên cPanel.
      console.error('[HANET] nhan:', JSON.stringify({
        id: payload.id,
        data_type: payload.data_type,
        personID: payload.personID,
        personName: payload.personName,
        personType: payload.personType,
      }));
      const clientSecret = process.env.HANET_CLIENT_SECRET;

      if (!clientSecret) {
        console.error("Hanet webhook: thiếu HANET_CLIENT_SECRET trong .env, từ chối toàn bộ request.");
        return res.status(500).json({ error: "Server misconfigured" });
      }

      if (!verifyHanetHash(payload.id, payload.hash, clientSecret)) {
        console.warn("Hanet webhook: hash không hợp lệ, từ chối request.", { id: payload.id });
        return res.status(401).json({ error: "Invalid signature" });
      }

      // Chỉ xử lý sâu sự kiện check-in (data_type = 'log'). Các loại khác (device/person/place)
      // tạm thời chỉ ghi log để biết là có xảy ra, chưa xử lý nghiệp vụ gì thêm.
      if (payload.data_type !== 'log') {
        console.log(`Hanet webhook: nhận sự kiện data_type="${payload.data_type}" action_type="${payload.action_type}" - chỉ ghi nhận, chưa xử lý sâu.`);
        return res.status(200).json({ received: true });
      }

      const { personID, personType, personName, detected_image_url } = payload;
      const checkinTime = parseHanetTime(payload.time);

      if (!personID || personType === undefined || !HANET_RECOGNIZED_PERSON_TYPES.includes(personType)) {
        // Người lạ / báo cháy / ảnh chụp thủ công / dữ liệu thiếu trường - bỏ qua, không tạo gì cả.
        return res.status(200).json({ received: true, processed: false });
      }

      // Tra học viên theo hanetPersonId (chỉ tính học viên chưa xóa mềm)
      const matchedStudents = await db.select().from(students)
        .where(and(eq(students.hanetPersonId, personID), eq(students.isDeleted, false)))
        .limit(1);

      if (matchedStudents.length === 0) {
        // Chưa có học viên nào liên kết với FaceID này trong hệ thống - nghĩa là cũng chưa thể
        // biết chắc tenant nào. Hạn chế đã biết: nếu sau này nhiều trung tâm cùng dùng chung
        // server này với các App Hanet riêng, cần ánh xạ theo `keycode` thay vì biến môi trường
        // cố định. Hiện tại dùng HANET_DEFAULT_TENANT_ID vì hệ thống mới có 1 trung tâm.
        const fallbackTenantId = process.env.HANET_DEFAULT_TENANT_ID || 'default-tenant';
        await db.insert(hanetPendingCheckins).values({
          tenantId: fallbackTenantId,
          hanetRecordId: payload.id,
          hanetPersonId: personID,
          personName: personName || null,
          studentId: null,
          candidateClassIds: null,
          checkinTime,
          imageUrl: detected_image_url || null,
          reason: 'unlinked_face',
        }).onDuplicateKeyUpdate({ set: { hanetRecordId: sql`hanet_record_id` } });
        return res.status(200).json({ received: true, processed: false });
      }

      const student = matchedStudents[0];
      const tenantId = student.tenantId;

      // Các lớp học viên đang ghi danh (chưa xóa mềm)
      const enrollments = await db.select({ classId: classEnrollments.classId })
        .from(classEnrollments)
        .where(and(
          eq(classEnrollments.studentId, student.id),
          eq(classEnrollments.tenantId, tenantId),
          eq(classEnrollments.isDeleted, false)
        ));

      if (enrollments.length === 0) {
        await db.insert(hanetPendingCheckins).values({
          tenantId,
          hanetRecordId: payload.id,
          hanetPersonId: personID,
          personName: personName || student.name,
          studentId: student.id,
          candidateClassIds: [],
          checkinTime,
          imageUrl: detected_image_url || null,
          reason: 'no_active_class',
        }).onDuplicateKeyUpdate({ set: { hanetRecordId: sql`hanet_record_id` } });
        return res.status(200).json({ received: true, processed: false });
      }

      const candidateClassIds = enrollments.map(e => e.classId);

      // Tìm phiên điểm danh đang mở (chưa đóng tay, chưa quá hạn) trong số các lớp học viên
      // đang học. Bắt buộc phải có ĐÚNG 1 phiên khớp mới tự động ghi điểm danh - áp dụng như
      // nhau dù học viên học 1 hay nhiều lớp, không có ngoại lệ.
      const sessionExpiry = new Date(Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
      const openSessions = await db.select().from(attendanceSessions)
        .where(and(
          inArray(attendanceSessions.classId, candidateClassIds),
          eq(attendanceSessions.tenantId, tenantId),
          isNull(attendanceSessions.closedAt),
          gte(attendanceSessions.openedAt, sessionExpiry)
        ));

      if (openSessions.length !== 1) {
        await db.insert(hanetPendingCheckins).values({
          tenantId,
          hanetRecordId: payload.id,
          hanetPersonId: personID,
          personName: personName || student.name,
          studentId: student.id,
          candidateClassIds,
          checkinTime,
          imageUrl: detected_image_url || null,
          reason: openSessions.length === 0 ? 'no_open_session' : 'multiple_open_sessions',
        }).onDuplicateKeyUpdate({ set: { hanetRecordId: sql`hanet_record_id` } });
        return res.status(200).json({ received: true, processed: false });
      }

      // Đúng 1 phiên khớp - tự động ghi điểm danh, tái sử dụng đúng logic upsert an toàn của
      // route POST /api/attendance: xóa mềm bản ghi cùng ngày nếu có, rồi ghi bản ghi mới,
      // toàn bộ trong 1 transaction để không bao giờ mất điểm danh cũ mà không có bản ghi thay thế.
      const matchedClassId = openSessions[0].classId;
      const startOfDay = new Date(checkinTime); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(checkinTime); endOfDay.setHours(23, 59, 59, 999);

      await db.transaction(async (tx) => {
        await tx.update(attendance)
          .set({ isDeleted: true, deletedAt: new Date() })
          .where(and(
            eq(attendance.tenantId, tenantId),
            eq(attendance.studentId, student.id),
            eq(attendance.classId, matchedClassId),
            eq(attendance.isDeleted, false),
            gte(attendance.date, startOfDay),
            lte(attendance.date, endOfDay)
          ));

        await tx.insert(attendance).values({
          tenantId,
          studentId: student.id,
          classId: matchedClassId,
          date: checkinTime,
          status: 'present',
          note: 'Điểm danh tự động qua camera Hanet',
        });
      });

      res.status(200).json({ received: true, processed: true });
    } catch (error: any) {
      console.error("Lỗi xử lý webhook Hanet:", error);
      // Khác với các nhánh nghiệp vụ ở trên (luôn trả 200 kể cả khi đưa vào hàng chờ),
      // lỗi hệ thống thật sự (DB lỗi, timeout...) trả 500 để Hanet có cơ hội gửi lại,
      // tránh mất hẳn sự kiện chỉ vì một trục trặc tạm thời.
      res.status(500).json({ error: "Internal error" });
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

  app.post("/api/users", requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { email, name, role, employeeCode, branchId, permissions } = req.body;
      
      // Check if user already exists across the whole system
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống." });
      }

      const pendingUid = `pending_${Date.now()}_${email}`;
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const result = await insertReturning(db, users, {
        uid: pendingUid,
        email,
        name: name || null,
        role: role || 'staff',
        employeeCode: employeeCode || null,
        branchId: branchId ? parseInt(branchId) : null,
        permissions: permissions || [],
        inviteCode,
        tenantId
      });

      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { id } = req.params;
      const { role, permissions } = req.body;

      // Ensure target user is in same tenant (done by where clause on tenantId)
      const result = await updateReturning(
        db,
        users,
        {
          ...(role && { role }),
          ...(permissions && { permissions })
        },
        and(eq(users.id, parseInt(id)), eq(users.tenantId, tenantId)),
      );
      
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
        const newSettings = await insertReturning(db, settings, {
          tenantId,
          centerName: 'Schooling',
          logoUrl: null
        });
        return res.json(newSettings);
      }
      
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { centerName, logoUrl } = req.body;
      
      let result = await db.select().from(settings).where(eq(settings.tenantId, tenantId)).limit(1);
      
      if (result.length === 0) {
        const newSettings = await insertReturning(db, settings, {
          tenantId,
          centerName,
          logoUrl
        });
        return res.json(newSettings);
      } else {
        const updatedSettings = await updateReturning(
          db,
          settings,
          { centerName, logoUrl, updatedAt: new Date() },
          eq(settings.tenantId, tenantId),
        );
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

  app.post("/api/branches", requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, code, phone, address } = req.body;
      const result = await insertReturning(db, branches, { tenantId, name, code, phone, address });
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create branch" });
    }
  });

  app.put("/api/branches/:id", requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, code, phone, address } = req.body;
      const branchId = parseInt(req.params.id);
      
      const result = await updateReturning(
        db,
        branches,
        { name, code, phone, address },
        and(eq(branches.id, branchId), eq(branches.tenantId, tenantId)),
      );
        
      if (result.length === 0) {
        return res.status(404).json({ error: "Branch not found or unauthorized" });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  // ===== Ca làm việc =====
  // Ca chỉ là khung giờ có tên, dùng lại cho cả thời khóa biểu lớp lẫn phân ca nhân viên.
  //
  // Phân quyền: đọc thì ai đăng nhập cũng được (giáo viên cần xem lịch, nhân viên cần xem
  // ca của mình). Ghi thì chỉ admin, hoặc người được admin cấp quyền '/shifts' riêng.

  /** Chuẩn hoá giờ về dạng HH:MM:SS để lưu và so sánh nhất quán. Trả null nếu sai định dạng. */
  const normalizeShiftTime = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = match[3] ? Number(match[3]) : 0;
    if (hour > 23 || minute > 59 || second > 59) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  };

  app.get("/api/shifts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const result = await db.select().from(shifts)
        .where(and(eq(shifts.tenantId, tenantId), eq(shifts.isDeleted, false)))
        .orderBy(shifts.startTime);
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

  app.post("/api/shifts", requireAuth, requirePermission('/shifts'), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, startTime, endTime, isAdministrative } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: "Vui lòng nhập tên ca." });
      }
      const start = normalizeShiftTime(startTime);
      const end = normalizeShiftTime(endTime);
      if (!start || !end) {
        return res.status(400).json({ error: "Giờ không hợp lệ. Định dạng đúng là HH:MM." });
      }
      // Chưa hỗ trợ ca qua đêm (ví dụ 22:00 - 06:00). Nếu về sau trung tâm cần, phải thêm
      // cờ đánh dấu ca qua đêm rồi sửa cả phần tính giờ công, không chỉ bỏ điều kiện này.
      if (end <= start) {
        return res.status(400).json({ error: "Giờ kết thúc phải sau giờ bắt đầu." });
      }

      const result = await insertReturning(db, shifts, {
        tenantId,
        name: name.trim(),
        startTime: start,
        endTime: end,
        isAdministrative: !!isAdministrative,
      });
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create shift" });
    }
  });

  app.put("/api/shifts/:id", requireAuth, requirePermission('/shifts'), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const shiftId = parseInt(req.params.id);
      const { name, startTime, endTime, isAdministrative } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: "Vui lòng nhập tên ca." });
      }
      const start = normalizeShiftTime(startTime);
      const end = normalizeShiftTime(endTime);
      if (!start || !end) {
        return res.status(400).json({ error: "Giờ không hợp lệ. Định dạng đúng là HH:MM." });
      }
      if (end <= start) {
        return res.status(400).json({ error: "Giờ kết thúc phải sau giờ bắt đầu." });
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
        and(eq(shifts.id, shiftId), eq(shifts.tenantId, tenantId), eq(shifts.isDeleted, false)),
      );

      if (result.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy ca làm việc." });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update shift" });
    }
  });

  app.delete("/api/shifts/:id", requireAuth, requirePermission('/shifts'), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const shiftId = parseInt(req.params.id);

      // CHẶN XÓA KHI CA ĐANG ĐƯỢC DÙNG. Xóa ca đang gắn với lịch học hoặc bảng công sẽ
      // làm những bản ghi đó trỏ tới một ca không còn tồn tại: lịch lớp mất giờ học, và
      // con số "đi muộn 15 phút" trong bảng công mất mốc đối chiếu.
      // Báo rõ đang vướng ở đâu để người dùng biết phải gỡ gì trước, thay vì chỉ từ chối.
      const [usedInClasses, usedInRoster, usedInTimesheet] = await Promise.all([
        db.select({ id: classSchedules.id }).from(classSchedules)
          .where(and(eq(classSchedules.shiftId, shiftId), eq(classSchedules.isDeleted, false))),
        db.select({ id: staffShifts.id }).from(staffShifts)
          .where(and(eq(staffShifts.shiftId, shiftId), eq(staffShifts.isDeleted, false))),
        db.select({ id: staffAttendance.id }).from(staffAttendance)
          .where(and(eq(staffAttendance.shiftId, shiftId), eq(staffAttendance.isDeleted, false))),
      ]);

      if (usedInClasses.length > 0 || usedInRoster.length > 0 || usedInTimesheet.length > 0) {
        const reasons: string[] = [];
        if (usedInClasses.length > 0) reasons.push(`${usedInClasses.length} lịch học`);
        if (usedInRoster.length > 0) reasons.push(`${usedInRoster.length} lượt phân ca nhân viên`);
        if (usedInTimesheet.length > 0) reasons.push(`${usedInTimesheet.length} bản ghi chấm công`);
        return res.status(400).json({
          error: `Không thể xóa vì ca này đang được dùng ở ${reasons.join(', ')}. Vui lòng gỡ khỏi những chỗ đó trước.`,
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
        and(eq(shifts.id, shiftId), eq(shifts.tenantId, tenantId), eq(shifts.isDeleted, false)),
      );

      if (result.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy ca làm việc." });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete shift" });
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

  app.post("/api/classes", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let { branchId, name, program, tuition, teacherId, sessionsPerMonth, feeMethod } = req.body;
      
      // If user is not admin, force their branchId
      if (req.dbUser?.role !== 'admin') {
        if (!req.dbUser?.branchId) {
          return res.status(403).json({ error: "You must be assigned to a branch to create classes." });
        }
        branchId = req.dbUser.branchId;
      }

      const result = await insertReturning(db, classes, { 
        tenantId, 
        branchId: parseInt(branchId), 
        teacherId: teacherId ? parseInt(teacherId) : null,
        name, 
        program, 
        tuition: tuition ? parseInt(tuition) : null,
        sessionsPerMonth: sessionsPerMonth ? parseInt(sessionsPerMonth) : null,
        feeMethod: feeMethod || 'per_session'
      });
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create class" });
    }
  });

  app.put("/api/classes/:id", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
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
      
      const result = await updateReturning(
        db,
        classes,
        {
          branchId: parseInt(branchId), 
          teacherId: teacherId ? parseInt(teacherId) : null,
          name, 
          program, 
          tuition: tuition ? parseInt(tuition) : null,
          sessionsPerMonth: sessionsPerMonth ? parseInt(sessionsPerMonth) : null,
          feeMethod: feeMethod || 'per_session'
        },
        and(eq(classes.id, parseInt(id)), eq(classes.tenantId, tenantId), eq(classes.isDeleted, false)),
      );
      res.json(result[0]);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to update class" });
    }
  });

  app.delete("/api/classes/:id", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
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

      // Soft delete: giữ lại toàn bộ dữ liệu lịch sử của lớp, chỉ đánh dấu đã xóa.
      // updateReturning chốt danh sách ID TRƯỚC khi cập nhật, nên vẫn đọc lại được bản ghi
      // sau khi nó vừa bị đánh dấu isDeleted = true (truy vấn lại bằng điều kiện cũ
      // "isDeleted = false" sẽ không tìm thấy gì, gây trả về rỗng dù thao tác thành công).
      const result = await updateReturning(
        db,
        classes,
        { isDeleted: true, deletedAt: new Date() },
        and(eq(classes.id, classId), eq(classes.tenantId, tenantId), eq(classes.isDeleted, false)),
      );
      res.json(result[0] || { success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete class" });
    }
  });

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

  // Tìm nhanh học viên theo tên hoặc mã, dùng cho ô chọn học viên ở trang hàng chờ
  // check-in Hanet (khi cần liên kết khuôn mặt với học viên lần đầu).
  //
  // VÌ SAO CẦN ENDPOINT RIÊNG thay vì dùng GET /api/students: route đó nối bảng qua ghi danh
  // nên (1) học viên học 2 lớp sẽ xuất hiện 2 lần trong danh sách chọn, và (2) học viên chưa
  // được xếp lớp nào sẽ không hiện ra. Ngoài ra với trung tâm vài nghìn học viên thì tải toàn
  // bộ danh sách vào một ô chọn là không dùng được - ở đây giới hạn 20 kết quả mỗi lần tìm.
  //
  // Ghi chú: chỉ giới hạn theo tenant, chưa lọc theo chi nhánh - giữ nhất quán với
  // GET /api/hanet-pending-checkins (endpoint mà ô chọn này phục vụ).
  app.get("/api/students/search", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';

      // Dưới 2 ký tự thì không tìm, tránh trả về gần như toàn bộ danh sách.
      if (rawQuery.length < 2) {
        return res.json([]);
      }

      const pattern = `%${rawQuery}%`;
      // Cột `name` dùng bảng mã utf8mb4_unicode_ci nên tìm không phân biệt hoa thường và
      // không phân biệt dấu - gõ "nguyen" vẫn ra "Nguyễn". Còn `student_code` dùng
      // utf8mb4_bin (so sánh chính xác từng ký tự) nên thêm biến thể viết hoa, vì mã học
      // viên theo quy ước là chữ hoa (mã tự sinh có dạng HV......).
      const upperPattern = `%${rawQuery.toUpperCase()}%`;

      const result = await db.select({
        id: students.id,
        name: students.name,
        studentCode: students.studentCode,
        hanetPersonId: students.hanetPersonId,
      })
      .from(students)
      .where(and(
        eq(students.tenantId, tenantId),
        eq(students.isDeleted, false),
        or(
          like(students.name, pattern),
          like(students.studentCode, pattern),
          like(students.studentCode, upperPattern),
        )
      ))
      .orderBy(students.name)
      .limit(20);

      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to search students" });
    }
  });

  app.post("/api/students", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
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
          note: note || null
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
        tuitionStatus: (req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager') ? (tuitionStatus || 'Chưa đóng') : 'Chưa đóng',
        tuitionOwed: (tuitionStatus === 'Còn thiếu' && tuitionOwed) ? parseInt(tuitionOwed) : 0,
        tuitionFee: tuitionFee ? parseInt(tuitionFee) : null,
        entryLevel: entryLevel || null,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null,
      });

      res.json({ ...student, classId: enrollmentRes?.classId, tuitionStatus: enrollmentRes?.tuitionStatus, tuitionOwed: enrollmentRes?.tuitionOwed });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create student" });
    }
  });

  app.post("/api/students/bulk", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
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

      // TÁCH RÕ 2 NHÓM TRƯỜNG: cột của bảng `students` và cột của bảng `class_enrollments`.
      //
      // LỖI CŨ ĐÃ SỬA: trước đây tất cả bị gộp chung vào một object rồi đưa thẳng vào
      // db.insert(students). Drizzle chỉ lấy những cột nó biết nên âm thầm bỏ qua classId,
      // entryLevel, enrollmentDate, tuitionFee, tuitionStatus, tuitionOwed - không báo lỗi gì.
      // Hậu quả: học viên nhập từ Excel được tạo nhưng KHÔNG được ghi danh vào lớp nào, nên
      // không bao giờ hiện ra trong danh sách lớp (route lấy học viên nối bảng qua ghi danh).
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

      // Giữ lại dữ liệu ghi danh theo mã học viên, để sau khi đọc lại id từ database thì gắn
      // đúng cho từng người. Khớp theo studentCode là chắc chắn: phần kiểm tra phía trên đã
      // bảo đảm các mã này không trùng nhau trong file và không trùng học viên đang hoạt động.
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

      // Tạo học viên VÀ ghi danh trong CÙNG 1 transaction: nếu bước ghi danh lỗi thì học viên
      // cũng không được tạo, tránh để lại học viên "mồ côi" không thuộc lớp nào - đúng tình
      // trạng mà lỗi cũ đã gây ra.
      const created = await db.transaction(async (tx) => {
        await tx.insert(students).values(studentRows);

        // MySQL không trả về được toàn bộ bản ghi sau khi thêm nhiều dòng cùng lúc (chỉ có id
        // của dòng ĐẦU TIÊN). Drizzle có `.$returningId()` nhưng với nhiều dòng nó suy ra các
        // id tiếp theo bằng cách cộng dồn - chỉ đúng khi khóa tự tăng cấp phát liền mạch,
        // không chắc chắn trong mọi cấu hình máy chủ.
        // Cách dưới đây xác định chắc chắn: đọc lại đúng những mã học viên vừa ghi.
        const insertedStudents = await tx.select().from(students).where(and(
          eq(students.tenantId, tenantId),
          eq(students.isDeleted, false),
          inArray(students.studentCode, insertedCodes)
        ));

        await tx.insert(classEnrollments).values(
          insertedStudents.map((st) => {
            const info = enrollmentByCode.get(st.studentCode);
            return {
              tenantId,
              studentId: st.id,
              classId: parsedClassId,
              tuitionStatus: 'Chưa đóng',
              tuitionOwed: 0,
              tuitionFee: info?.tuitionFee ?? null,
              entryLevel: info?.entryLevel ?? null,
              enrollmentDate: info?.enrollmentDate ?? null,
            };
          })
        );

        // Trả về học viên kèm thông tin ghi danh, cùng dạng với route tạo từng học viên một.
        return insertedStudents.map((st) => {
          const info = enrollmentByCode.get(st.studentCode);
          return {
            ...st,
            classId: parsedClassId,
            tuitionStatus: 'Chưa đóng',
            tuitionOwed: 0,
            tuitionFee: info?.tuitionFee ?? null,
            entryLevel: info?.entryLevel ?? null,
            enrollmentDate: info?.enrollmentDate ?? null,
          };
        });
      });

      res.json(created);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Bulk insert failed" });
    }
  });

  app.put("/api/students/:id", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { id } = req.params;
      const { name, phone, classId, tuitionStatus, tuitionOwed } = req.body;
      
      const result = await updateReturning(
        db,
        students,
        { name, phone },
        and(eq(students.id, parseInt(id)), eq(students.tenantId, tenantId), eq(students.isDeleted, false)),
      );
        
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

  // Gỡ liên kết khuôn mặt Hanet khỏi một học viên.
  // Cần thiết khi nhân viên lỡ gán nhầm khuôn mặt cho sai người: gỡ ở đây rồi mới gán lại
  // được cho đúng người (ràng buộc duy nhất không cho 1 khuôn mặt gắn 2 học viên cùng lúc).
  // Chỉ xóa liên kết, KHÔNG xóa học viên và không đụng tới dữ liệu bên Hanet.
  app.delete("/api/students/:id/hanet-link", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const studentId = parseInt(req.params.id);

      // Cùng quy tắc như thao tác cập nhật khuôn mặt trước đây: người không phải admin chỉ
      // được gỡ liên kết của học viên có lớp thuộc đúng chi nhánh mình.
      if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classEnrollments.id })
          .from(classEnrollments)
          .innerJoin(classes, eq(classEnrollments.classId, classes.id))
          .where(and(
            eq(classEnrollments.studentId, studentId),
            eq(classEnrollments.tenantId, tenantId),
            eq(classEnrollments.isDeleted, false),
            eq(classes.branchId, req.dbUser.branchId)
          )).limit(1);
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Bạn không có quyền thao tác với học viên ngoài chi nhánh mình." });
        }
      }

      const result = await updateReturning(
        db,
        students,
        { hanetPersonId: null },
        and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false)),
      );

      if (result.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy học viên" });
      }
      res.json({ success: true, student: result[0] });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to unlink Hanet face" });
    }
  });

  app.delete("/api/students/:id", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
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

        return await insertReturning(tx, attendance, {
          tenantId,
          studentId: parseInt(studentId),
          classId: parseInt(classId),
          date: new Date(date),
          status,
          homeworkCompleted: homeworkCompleted ? 1 : 0,
          note
        });
      });

      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to mark attendance" });
    }
  });

  // ===== Phiên điểm danh (dùng để khớp check-in camera Hanet vào đúng lớp) =====
  // Liệt kê các phiên điểm danh ĐANG MỞ (chưa đóng tay và chưa quá hạn).
  // Giao diện cần endpoint này để biết hiển thị nút "Bắt đầu" hay "Kết thúc" cho mỗi lớp.
  // Truyền ?classId=... để lọc theo 1 lớp (khi đó kết quả có 0 hoặc 1 phần tử).
  app.get("/api/attendance-sessions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId } = req.query;

      // Giới hạn phạm vi theo vai trò, cùng quy tắc với GET /api/students:
      // giáo viên chỉ thấy lớp mình dạy, nhân viên/quản lý chỉ thấy lớp thuộc chi nhánh mình.
      let allowedClassIds: number[] | null = null;
      if (req.dbUser?.role === 'teacher') {
        const allowedClasses = await db.select({ id: classes.id }).from(classes)
          .where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.isDeleted, false)));
        allowedClassIds = allowedClasses.map(c => c.id);
      } else if (req.dbUser?.role !== 'admin' && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes)
          .where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.isDeleted, false)));
        allowedClassIds = allowedClasses.map(c => c.id);
      }
      // Không có lớp nào được phép -> trả mảng rỗng luôn. Bắt buộc phải chặn ở đây vì
      // MySQL báo lỗi cú pháp với `IN ()` rỗng (khác PostgreSQL).
      if (allowedClassIds && allowedClassIds.length === 0) {
        return res.json([]);
      }

      const sessionExpiry = new Date(Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
      const conditions = [
        eq(attendanceSessions.tenantId, tenantId),
        isNull(attendanceSessions.closedAt),
        gte(attendanceSessions.openedAt, sessionExpiry),
      ];
      if (classId) {
        conditions.push(eq(attendanceSessions.classId, parseInt(classId as string)));
      }
      if (allowedClassIds) {
        conditions.push(inArray(attendanceSessions.classId, allowedClassIds));
      }

      const result = await db.select().from(attendanceSessions)
        .where(and(...conditions))
        .orderBy(desc(attendanceSessions.openedAt));

      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch attendance sessions" });
    }
  });

  app.post("/api/attendance-sessions", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(403).json({ error: "Không xác định được người dùng" });
      }
      const tenantId = req.dbUser.tenantId || req.user!.uid;
      const { classId } = req.body;

      if (!classId || isNaN(parseInt(classId))) {
        return res.status(400).json({ error: "classId là bắt buộc" });
      }
      const parsedClassId = parseInt(classId);

      // Cùng quy tắc phân quyền theo lớp như các route khác: giáo viên chỉ mở được phiên cho
      // lớp mình dạy, nhân viên/quản lý chi nhánh chỉ mở được cho lớp thuộc chi nhánh mình.
      if (req.dbUser.role === 'teacher') {
        const allowed = await db.select({ id: classes.id }).from(classes)
          .where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.id, parsedClassId), eq(classes.isDeleted, false)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Bạn không phụ trách lớp này" });
        }
      } else if (req.dbUser.role !== 'admin' && req.dbUser.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes)
          .where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parsedClassId), eq(classes.isDeleted, false)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Lớp này không thuộc chi nhánh của bạn" });
        }
      }

      // Nếu lớp này đã có 1 phiên đang mở (chưa đóng, chưa quá hạn) thì trả về luôn phiên đó,
      // không tạo trùng - tránh trường hợp bấm nhầm 2 lần tạo ra 2 phiên cùng mở cho 1 lớp,
      // vì điều đó sẽ khiến webhook hiểu nhầm thành "nhiều phiên cùng mở" (multiple_open_sessions).
      const sessionExpiry = new Date(Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
      const existingOpen = await db.select().from(attendanceSessions)
        .where(and(
          eq(attendanceSessions.classId, parsedClassId),
          eq(attendanceSessions.tenantId, tenantId),
          isNull(attendanceSessions.closedAt),
          gte(attendanceSessions.openedAt, sessionExpiry)
        )).limit(1);

      if (existingOpen.length > 0) {
        return res.json(existingOpen[0]);
      }

      const result = await insertReturning(db, attendanceSessions, {
        tenantId,
        classId: parsedClassId,
        openedBy: req.dbUser.id,
      });

      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to open attendance session" });
    }
  });

  app.put("/api/attendance-sessions/:id/close", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(403).json({ error: "Không xác định được người dùng" });
      }
      const tenantId = req.dbUser.tenantId || req.user!.uid;
      const sessionId = parseInt(req.params.id);

      const existing = await db.select().from(attendanceSessions)
        .where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.tenantId, tenantId)))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy phiên điểm danh" });
      }
      const session = existing[0];

      if (req.dbUser.role === 'teacher') {
        const allowed = await db.select({ id: classes.id }).from(classes)
          .where(and(eq(classes.id, session.classId), eq(classes.teacherId, req.dbUser.id)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Bạn không phụ trách lớp này" });
        }
      } else if (req.dbUser.role !== 'admin' && req.dbUser.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes)
          .where(and(eq(classes.id, session.classId), eq(classes.branchId, req.dbUser.branchId)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Lớp này không thuộc chi nhánh của bạn" });
        }
      }

      // Điều kiện isNull(closedAt) làm cho việc đóng phiên trở nên "vô hại khi lặp lại":
      // bấm đóng 2 lần không gây lỗi, lần 2 chỉ đơn giản không đổi gì thêm.
      const result = await updateReturning(
        db,
        attendanceSessions,
        { closedAt: new Date() },
        and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.tenantId, tenantId), isNull(attendanceSessions.closedAt)),
      );

      res.json(result[0] || session);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to close attendance session" });
    }
  });

  // ===== Hàng đợi check-in Hanet chưa xác định được lớp =====
  // GET để liệt kê hàng chờ - cần thiết để endpoint resolve/dismiss bên dưới thực sự dùng được
  // (không có cách nào chọn "1 dòng để xử lý" nếu không có gì hiển thị danh sách trước).
  app.get("/api/hanet-pending-checkins", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;

      // Ghi chú: chưa lọc theo chi nhánh ở đây (candidateClassIds là mảng, lọc theo chi nhánh
      // cần so khớp mảng phức tạp hơn). Hàng đợi này thường ít dòng và cần xử lý nhanh, không
      // phải dữ liệu nhạy cảm dài hạn, nên tạm thời mọi nhân viên trong tenant đều xem chung.
      //
      // Dùng LEFT JOIN để lấy kèm tên học viên: các dòng đã liên kết được học viên thì giao
      // diện hiển thị tên trong hệ thống (đáng tin hơn personName do Hanet gửi, vốn có thể
      // để trống hoặc khác với tên đang lưu). LEFT chứ không INNER vì dòng 'unlinked_face'
      // chưa có học viên nào - dùng INNER sẽ làm mất hẳn những dòng đó khỏi hàng chờ.
      const result = await db.select({
        id: hanetPendingCheckins.id,
        hanetRecordId: hanetPendingCheckins.hanetRecordId,
        hanetPersonId: hanetPendingCheckins.hanetPersonId,
        personName: hanetPendingCheckins.personName,
        studentId: hanetPendingCheckins.studentId,
        candidateClassIds: hanetPendingCheckins.candidateClassIds,
        checkinTime: hanetPendingCheckins.checkinTime,
        imageUrl: hanetPendingCheckins.imageUrl,
        reason: hanetPendingCheckins.reason,
        createdAt: hanetPendingCheckins.createdAt,
        studentName: students.name,
        studentCode: students.studentCode,
      })
        .from(hanetPendingCheckins)
        .leftJoin(students, eq(hanetPendingCheckins.studentId, students.id))
        .where(and(eq(hanetPendingCheckins.tenantId, tenantId), isNull(hanetPendingCheckins.resolvedAt)))
        .orderBy(desc(hanetPendingCheckins.checkinTime));

      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch pending checkins" });
    }
  });

  app.put("/api/hanet-pending-checkins/:id/resolve", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(403).json({ error: "Không xác định được người dùng" });
      }
      const tenantId = req.dbUser.tenantId || req.user!.uid;
      const pendingId = parseInt(req.params.id);
      const { classId, studentId } = req.body;

      if (!classId || isNaN(parseInt(classId))) {
        return res.status(400).json({ error: "classId là bắt buộc" });
      }
      const parsedClassId = parseInt(classId);

      // Kiểm tra quyền với lớp được chọn NGAY TỪ ĐẦU - trước khi chạm vào bất kỳ dữ liệu nào
      // khác, kể cả việc xác thực/liên kết học viên bên dưới. Trước đây bước liên kết học viên
      // chạy TRƯỚC kiểm tra quyền này, nghĩa là 1 nhân viên chọn đúng học viên nhưng sai lớp
      // (ngoài chi nhánh mình) vẫn khiến hệ thống ghi hanetPersonId cho học viên đó trước khi
      // bị từ chối vì sai quyền lớp - đã sửa lại đúng thứ tự: không quyền thì không chạm gì cả.
      if (req.dbUser.role === 'teacher') {
        const allowed = await db.select({ id: classes.id }).from(classes)
          .where(and(eq(classes.tenantId, tenantId), eq(classes.teacherId, req.dbUser.id), eq(classes.id, parsedClassId)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Bạn không phụ trách lớp này" });
        }
      } else if (req.dbUser.role !== 'admin' && req.dbUser.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes)
          .where(and(eq(classes.tenantId, tenantId), eq(classes.branchId, req.dbUser.branchId), eq(classes.id, parsedClassId)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Lớp này không thuộc chi nhánh của bạn" });
        }
      }

      const pendingRows = await db.select().from(hanetPendingCheckins)
        .where(and(eq(hanetPendingCheckins.id, pendingId), eq(hanetPendingCheckins.tenantId, tenantId)))
        .limit(1);
      if (pendingRows.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy check-in này" });
      }
      const pending = pendingRows[0];
      if (pending.resolvedAt) {
        return res.status(400).json({ error: "Check-in này đã được xử lý trước đó" });
      }

      // Trường hợp 'unlinked_face': hàng chờ chưa gắn học viên nào - ở đây chỉ XÁC THỰC học
      // viên có tồn tại (đọc, chưa ghi gì cả). Việc thực sự GHI hanetPersonId chuyển xuống
      // trong transaction bên dưới, cùng lúc với tạo điểm danh - để không bao giờ xảy ra tình
      // huống "đã lỡ liên kết khuôn mặt nhưng request lại thất bại vì lý do khác".
      let resolvedStudentId = pending.studentId;
      let studentIdToLink: number | null = null;

      if (!resolvedStudentId) {
        if (!studentId) {
          return res.status(400).json({ error: "Cần chọn học viên để liên kết với khuôn mặt Hanet này" });
        }
        const targetStudent = await db.select().from(students)
          .where(and(eq(students.id, parseInt(studentId)), eq(students.tenantId, tenantId), eq(students.isDeleted, false)))
          .limit(1);
        if (targetStudent.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy học viên" });
        }

        // Khuôn mặt này đã gắn cho học viên KHÁC chưa? Tình huống xảy ra khi camera quét
        // cùng một người 2 lần trước lúc được liên kết, tạo ra 2 dòng trong hàng chờ, rồi
        // nhân viên lỡ gán 2 dòng đó cho 2 học viên khác nhau.
        // Ràng buộc duy nhất ở database vẫn chặn được, nhưng nó ném lỗi khó hiểu - kiểm tra
        // trước ở đây để báo rõ ai đang giữ khuôn mặt và cách xử lý.
        const alreadyLinked = await db.select({
          id: students.id,
          name: students.name,
          studentCode: students.studentCode,
        })
          .from(students)
          .where(and(
            eq(students.hanetPersonId, pending.hanetPersonId),
            eq(students.tenantId, tenantId),
            eq(students.isDeleted, false)
          ))
          .limit(1);

        if (alreadyLinked.length > 0 && alreadyLinked[0].id !== targetStudent[0].id) {
          return res.status(400).json({
            error: `Khuôn mặt này đã được liên kết với học viên ${alreadyLinked[0].name} (${alreadyLinked[0].studentCode}). Nếu liên kết đó sai, hãy gỡ liên kết của học viên ${alreadyLinked[0].name} trước rồi thử lại.`,
            conflictStudentId: alreadyLinked[0].id,
            conflictStudentName: alreadyLinked[0].name,
          });
        }

        resolvedStudentId = targetStudent[0].id;
        studentIdToLink = targetStudent[0].id;
      }

      const finalStudentId = resolvedStudentId;
      const checkinTime = pending.checkinTime;
      const startOfDay = new Date(checkinTime); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(checkinTime); endOfDay.setHours(23, 59, 59, 999);

      // Toàn bộ phần GHI (liên kết khuôn mặt nếu cần + tạo điểm danh + đánh dấu đã xử lý) giờ
      // nằm chung trong 1 transaction - hoặc tất cả cùng thành công, hoặc không có gì thay đổi
      // nếu có bước nào lỗi giữa chừng.
      await db.transaction(async (tx) => {
        if (studentIdToLink) {
          await tx.update(students)
            .set({ hanetPersonId: pending.hanetPersonId })
            .where(eq(students.id, studentIdToLink));
        }

        await tx.update(attendance)
          .set({ isDeleted: true, deletedAt: new Date() })
          .where(and(
            eq(attendance.tenantId, tenantId),
            eq(attendance.studentId, finalStudentId),
            eq(attendance.classId, parsedClassId),
            eq(attendance.isDeleted, false),
            gte(attendance.date, startOfDay),
            lte(attendance.date, endOfDay)
          ));

        await tx.insert(attendance).values({
          tenantId,
          studentId: finalStudentId,
          classId: parsedClassId,
          date: checkinTime,
          status: 'present',
          note: 'Điểm danh qua camera Hanet (nhân viên xác nhận lớp thủ công)',
        });

        await tx.update(hanetPendingCheckins)
          .set({
            resolvedAt: new Date(),
            resolvedClassId: parsedClassId,
            resolvedBy: req.dbUser!.id,
            studentId: finalStudentId,
          })
          .where(eq(hanetPendingCheckins.id, pendingId));
      });

      res.json({ success: true });
    } catch (error: any) {
      // Lớp bảo vệ thứ hai: nếu 2 người cùng xử lý đúng một thời điểm, cả hai có thể lọt qua
      // bước kiểm tra ở trên rồi cùng ghi - lúc đó ràng buộc duy nhất ở database chặn lại.
      // Đổi lỗi kỹ thuật đó thành thông báo người dùng hiểu được.
      const message = typeof error?.message === 'string' ? error.message : '';
      const isDuplicateKey = error?.code === 'ER_DUP_ENTRY'
        || error?.errno === 1062
        || message.includes('Duplicate entry');

      if (isDuplicateKey) {
        return res.status(400).json({
          error: "Khuôn mặt này vừa được liên kết với một học viên khác. Vui lòng tải lại trang và kiểm tra lại.",
        });
      }

      console.error(error);
      res.status(500).json({ error: "Failed to resolve pending checkin" });
    }
  });

  // Bỏ qua 1 dòng trong hàng chờ mà KHÔNG tạo điểm danh (ví dụ: nhận diện nhầm, khách vãng lai
  // không phải học viên...). Không có cách này thì hàng chờ sẽ tồn đọng mãi những dòng không
  // nên trở thành điểm danh, không có lối thoát nào để dọn hàng chờ.
  app.put("/api/hanet-pending-checkins/:id/dismiss", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(403).json({ error: "Không xác định được người dùng" });
      }
      const tenantId = req.dbUser.tenantId || req.user!.uid;
      const pendingId = parseInt(req.params.id);

      // Giống chỗ chiếm mã kích hoạt: điều kiện isNull(resolvedAt) ngay trong câu UPDATE là
      // thứ chống việc 2 người cùng xử lý một dòng hàng chờ. Tách thành đọc-rồi-ghi sẽ làm
      // mất tính nguyên tử đó, nên ở đây giữ nguyên 1 câu UPDATE và đọc số dòng bị ảnh hưởng.
      const [dismissResult] = await db.update(hanetPendingCheckins)
        .set({ resolvedAt: new Date(), resolvedBy: req.dbUser.id })
        .where(and(
          eq(hanetPendingCheckins.id, pendingId),
          eq(hanetPendingCheckins.tenantId, tenantId),
          isNull(hanetPendingCheckins.resolvedAt)
        ));

      if (dismissResult.affectedRows === 0) {
        return res.status(404).json({ error: "Không tìm thấy hoặc đã được xử lý trước đó" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to dismiss pending checkin" });
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

  app.post("/api/transactions", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let { branchId, type, category, amount, date, note, studentId } = req.body;
      
      if (req.dbUser?.role !== 'admin') {
        if (!req.dbUser?.branchId) {
          return res.status(403).json({ error: "You must be assigned to a branch to create transactions." });
        }
        branchId = req.dbUser.branchId;
      }
      
      const result = await insertReturning(db, transactions, {
        tenantId,
        branchId: branchId ? parseInt(branchId) : null,
        type,
        category,
        amount: parseInt(amount),
        date: date ? new Date(date) : new Date(),
        note,
        studentId: studentId ? parseInt(studentId) : null,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  app.delete("/api/transactions/:id", requireAuth, requireRole(['admin', 'manager', 'staff']), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      
      // Ca xóa mềm: updateReturning chốt ID trước khi cập nhật nên vẫn đọc lại được bản ghi
      // sau khi nó vừa bị đánh dấu isDeleted = true.
      const result = await updateReturning(
        db,
        transactions,
        { isDeleted: true, deletedAt: new Date() },
        and(eq(transactions.id, parseInt(req.params.id)), eq(transactions.tenantId, tenantId), eq(transactions.isDeleted, false)),
      );
      
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

  app.post("/api/promotions", requireAuth, requirePermission('/promotions'), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, discountType, discountValue, branchIds, startDate, endDate, isActive } = req.body;

      if (discountType === 'percentage' && discountValue > 100) {
        return res.status(400).json({ error: "Phần trăm giảm giá không được vượt quá 100" });
      }

      const newPromo = await insertReturning(db, promotions, {
        tenantId,
        name,
        discountType,
        discountValue,
        branchIds,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : true
      });
      
      res.json(newPromo);
    } catch (error) {
      console.error("Lỗi tạo ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  app.put("/api/promotions/:id", requireAuth, requirePermission('/promotions'), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const promoId = parseInt(req.params.id);
      const { name, discountType, discountValue, branchIds, startDate, endDate, isActive } = req.body;

      if (discountType === 'percentage' && discountValue > 100) {
        return res.status(400).json({ error: "Phần trăm giảm giá không được vượt quá 100" });
      }

      const [updatedPromo] = await updateReturning(
        db,
        promotions,
        {
          name,
          discountType,
          discountValue,
          branchIds,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          isActive,
          updatedAt: new Date()
        },
        and(eq(promotions.id, promoId), eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false)),
      );

      if (!updatedPromo) {
        return res.status(404).json({ error: "Không tìm thấy ưu đãi" });
      }
      res.json(updatedPromo);
    } catch (error) {
      console.error("Lỗi cập nhật ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  app.delete("/api/promotions/:id", requireAuth, requirePermission('/promotions'), async (req: AuthRequest, res) => {
    try {
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