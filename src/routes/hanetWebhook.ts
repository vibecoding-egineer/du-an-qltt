/**
 * Webhook Hanet AI Camera + Hàng đợi check-in chưa xác định được lớp.
 *
 * Route CÔNG KHAI - Hanet gọi trực tiếp từ camera/cloud của họ, KHÔNG có Firebase token nên
 * KHÔNG qua requireAuth. Bảo mật bằng cách tự tính lại hash = MD5(client_secret + id) và so
 * khớp với hash Hanet gửi kèm mỗi request.
 */
import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import {
  students,
  classes,
  classEnrollments,
  attendance,
  attendanceSessions,
  hanetPendingCheckins,
} from "../db/schema.js";
import { eq, and, gte, lte, inArray, desc, isNull, sql } from "drizzle-orm";
import {
  verifyHanetHash,
  parseHanetTime,
  HANET_RECOGNIZED_PERSON_TYPES,
  type HanetWebhookPayload,
} from "../lib/hanet.js";
import { HANET_SESSION_EXPIRY_HOURS } from "./_helpers.js";

export function registerHanetRoutes(app: Express): void {
  app.post("/api/webhooks/hanet", async (req, res) => {
    try {
      const payload = req.body as HanetWebhookPayload;

      console.error(
        "[HANET] nhan:",
        JSON.stringify({
          id: payload.id,
          data_type: payload.data_type,
          personID: payload.personID,
          personName: payload.personName,
          personType: payload.personType,
        }),
      );
      const clientSecret = process.env.HANET_CLIENT_SECRET;

      if (!clientSecret) {
        console.error(
          "Hanet webhook: thiếu HANET_CLIENT_SECRET trong .env, từ chối toàn bộ request.",
        );
        return res.status(500).json({ error: "Server misconfigured" });
      }

      if (!verifyHanetHash(payload.id, payload.hash, clientSecret)) {
        console.warn("Hanet webhook: hash không hợp lệ, từ chối request.", {
          id: payload.id,
        });
        return res.status(401).json({ error: "Invalid signature" });
      }

      if (payload.data_type !== "log") {
        console.log(
          `Hanet webhook: nhận sự kiện data_type="${payload.data_type}" action_type="${payload.action_type}" - chỉ ghi nhận, chưa xử lý sâu.`,
        );
        return res.status(200).json({ received: true });
      }

      const { personID, personType, personName, detected_image_url } = payload;
      const checkinTime = parseHanetTime(payload.time);

      if (
        !personID ||
        personType === undefined ||
        !HANET_RECOGNIZED_PERSON_TYPES.includes(personType)
      ) {
        return res.status(200).json({ received: true, processed: false });
      }

      // Tra học viên theo hanetPersonId (chỉ tính học viên chưa xóa mềm)
      const matchedStudents = await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.hanetPersonId, personID),
            eq(students.isDeleted, false),
          ),
        )
        .limit(1);

      if (matchedStudents.length === 0) {
        const fallbackTenantId =
          process.env.HANET_DEFAULT_TENANT_ID || "default-tenant";
        await db
          .insert(hanetPendingCheckins)
          .values({
            tenantId: fallbackTenantId,
            hanetRecordId: payload.id,
            hanetPersonId: personID,
            personName: personName || null,
            studentId: null,
            candidateClassIds: null,
            checkinTime,
            imageUrl: detected_image_url || null,
            reason: "unlinked_face",
          })
          .onDuplicateKeyUpdate({
            set: { hanetRecordId: sql`hanet_record_id` },
          });
        return res.status(200).json({ received: true, processed: false });
      }

      const student = matchedStudents[0];
      const tenantId = student.tenantId;

      const enrollments = await db
        .select({ classId: classEnrollments.classId })
        .from(classEnrollments)
        .where(
          and(
            eq(classEnrollments.studentId, student.id),
            eq(classEnrollments.tenantId, tenantId),
            eq(classEnrollments.isDeleted, false),
          ),
        );

      if (enrollments.length === 0) {
        await db
          .insert(hanetPendingCheckins)
          .values({
            tenantId,
            hanetRecordId: payload.id,
            hanetPersonId: personID,
            personName: personName || student.name,
            studentId: student.id,
            candidateClassIds: [],
            checkinTime,
            imageUrl: detected_image_url || null,
            reason: "no_active_class",
          })
          .onDuplicateKeyUpdate({
            set: { hanetRecordId: sql`hanet_record_id` },
          });
        return res.status(200).json({ received: true, processed: false });
      }

      const candidateClassIds = enrollments.map((e) => e.classId);

      const sessionExpiry = new Date(
        Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
      );
      const openSessions = await db
        .select()
        .from(attendanceSessions)
        .where(
          and(
            inArray(attendanceSessions.classId, candidateClassIds),
            eq(attendanceSessions.tenantId, tenantId),
            isNull(attendanceSessions.closedAt),
            gte(attendanceSessions.openedAt, sessionExpiry),
          ),
        );

      if (openSessions.length !== 1) {
        await db
          .insert(hanetPendingCheckins)
          .values({
            tenantId,
            hanetRecordId: payload.id,
            hanetPersonId: personID,
            personName: personName || student.name,
            studentId: student.id,
            candidateClassIds,
            checkinTime,
            imageUrl: detected_image_url || null,
            reason:
              openSessions.length === 0
                ? "no_open_session"
                : "multiple_open_sessions",
          })
          .onDuplicateKeyUpdate({
            set: { hanetRecordId: sql`hanet_record_id` },
          });
        return res.status(200).json({ received: true, processed: false });
      }

      const matchedClassId = openSessions[0].classId;
      const startOfDay = new Date(checkinTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(checkinTime);
      endOfDay.setHours(23, 59, 59, 999);

      await db.transaction(async (tx) => {
        await tx
          .update(attendance)
          .set({ isDeleted: true, deletedAt: new Date() })
          .where(
            and(
              eq(attendance.tenantId, tenantId),
              eq(attendance.studentId, student.id),
              eq(attendance.classId, matchedClassId),
              eq(attendance.isDeleted, false),
              gte(attendance.date, startOfDay),
              lte(attendance.date, endOfDay),
            ),
          );

        await tx.insert(attendance).values({
          tenantId,
          studentId: student.id,
          classId: matchedClassId,
          date: checkinTime,
          status: "present",
          note: "Điểm danh tự động qua camera Hanet",
        });
      });

      res.status(200).json({ received: true, processed: true });
    } catch (error: unknown) {
      console.error("Lỗi xử lý webhook Hanet:", error);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // ===== Hàng đợi check-in Hanet =====
  app.get(
    "/api/hanet-pending-checkins",
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;

        const result = await db
          .select({
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
          .leftJoin(
            students,
            eq(hanetPendingCheckins.studentId, students.id),
          )
          .where(
            and(
              eq(hanetPendingCheckins.tenantId, tenantId),
              isNull(hanetPendingCheckins.resolvedAt),
            ),
          )
          .orderBy(desc(hanetPendingCheckins.checkinTime));

        res.json(result);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch pending checkins" });
      }
    },
  );

  app.put(
    "/api/hanet-pending-checkins/:id/resolve",
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        if (!req.dbUser) {
          return res
            .status(403)
            .json({ error: "Không xác định được người dùng" });
        }
        const tenantId = req.dbUser.tenantId || req.user!.uid;
        const pendingId = parseInt(req.params.id);
        const { classId, studentId } = req.body;

        if (!classId || isNaN(parseInt(classId))) {
          return res.status(400).json({ error: "classId là bắt buộc" });
        }
        const parsedClassId = parseInt(classId);

        // Kiểm tra quyền với lớp được chọn NGAY TỪ ĐẦU
        if (req.dbUser.role === "teacher") {
          const allowed = await db
            .select({ id: classes.id })
            .from(classes)
            .where(
              and(
                eq(classes.tenantId, tenantId),
                eq(classes.teacherId, req.dbUser.id),
                eq(classes.id, parsedClassId),
              ),
            );
          if (allowed.length === 0) {
            return res
              .status(403)
              .json({ error: "Bạn không phụ trách lớp này" });
          }
        } else if (req.dbUser.role !== "admin" && req.dbUser.branchId) {
          const allowed = await db
            .select({ id: classes.id })
            .from(classes)
            .where(
              and(
                eq(classes.tenantId, tenantId),
                eq(classes.branchId, req.dbUser.branchId),
                eq(classes.id, parsedClassId),
              ),
            );
          if (allowed.length === 0) {
            return res
              .status(403)
              .json({ error: "Lớp này không thuộc chi nhánh của bạn" });
          }
        }

        const pendingRows = await db
          .select()
          .from(hanetPendingCheckins)
          .where(
            and(
              eq(hanetPendingCheckins.id, pendingId),
              eq(hanetPendingCheckins.tenantId, tenantId),
            ),
          )
          .limit(1);
        if (pendingRows.length === 0) {
          return res
            .status(404)
            .json({ error: "Không tìm thấy check-in này" });
        }
        const pending = pendingRows[0];
        if (pending.resolvedAt) {
          return res
            .status(400)
            .json({ error: "Check-in này đã được xử lý trước đó" });
        }

        let resolvedStudentId = pending.studentId;
        let studentIdToLink: number | null = null;

        if (!resolvedStudentId) {
          if (!studentId) {
            return res.status(400).json({
              error:
                "Cần chọn học viên để liên kết với khuôn mặt Hanet này",
            });
          }
          const targetStudent = await db
            .select()
            .from(students)
            .where(
              and(
                eq(students.id, parseInt(studentId)),
                eq(students.tenantId, tenantId),
                eq(students.isDeleted, false),
              ),
            )
            .limit(1);
          if (targetStudent.length === 0) {
            return res
              .status(404)
              .json({ error: "Không tìm thấy học viên" });
          }

          const alreadyLinked = await db
            .select({
              id: students.id,
              name: students.name,
              studentCode: students.studentCode,
            })
            .from(students)
            .where(
              and(
                eq(students.hanetPersonId, pending.hanetPersonId),
                eq(students.tenantId, tenantId),
                eq(students.isDeleted, false),
              ),
            )
            .limit(1);

          if (
            alreadyLinked.length > 0 &&
            alreadyLinked[0].id !== targetStudent[0].id
          ) {
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
        const startOfDay = new Date(checkinTime);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(checkinTime);
        endOfDay.setHours(23, 59, 59, 999);

        await db.transaction(async (tx) => {
          if (studentIdToLink) {
            await tx
              .update(students)
              .set({ hanetPersonId: pending.hanetPersonId })
              .where(eq(students.id, studentIdToLink));
          }

          await tx
            .update(attendance)
            .set({ isDeleted: true, deletedAt: new Date() })
            .where(
              and(
                eq(attendance.tenantId, tenantId),
                eq(attendance.studentId, finalStudentId),
                eq(attendance.classId, parsedClassId),
                eq(attendance.isDeleted, false),
                gte(attendance.date, startOfDay),
                lte(attendance.date, endOfDay),
              ),
            );

          await tx.insert(attendance).values({
            tenantId,
            studentId: finalStudentId,
            classId: parsedClassId,
            date: checkinTime,
            status: "present",
            note: "Điểm danh qua camera Hanet (nhân viên xác nhận lớp thủ công)",
          });

          await tx
            .update(hanetPendingCheckins)
            .set({
              resolvedAt: new Date(),
              resolvedClassId: parsedClassId,
              resolvedBy: req.dbUser!.id,
              studentId: finalStudentId,
            })
            .where(eq(hanetPendingCheckins.id, pendingId));
        });

        res.json({ success: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "";
        const errObj = error as any;
        const isDuplicateKey =
          errObj?.code === "ER_DUP_ENTRY" ||
          errObj?.errno === 1062 ||
          message.includes("Duplicate entry");

        if (isDuplicateKey) {
          return res.status(400).json({
            error:
              "Khuôn mặt này vừa được liên kết với một học viên khác. Vui lòng tải lại trang và kiểm tra lại.",
          });
        }

        console.error(error);
        res.status(500).json({ error: "Failed to resolve pending checkin" });
      }
    },
  );

  app.put(
    "/api/hanet-pending-checkins/:id/dismiss",
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        if (!req.dbUser) {
          return res
            .status(403)
            .json({ error: "Không xác định được người dùng" });
        }
        const tenantId = req.dbUser.tenantId || req.user!.uid;
        const pendingId = parseInt(req.params.id);

        const [dismissResult] = await db
          .update(hanetPendingCheckins)
          .set({ resolvedAt: new Date(), resolvedBy: req.dbUser.id })
          .where(
            and(
              eq(hanetPendingCheckins.id, pendingId),
              eq(hanetPendingCheckins.tenantId, tenantId),
              isNull(hanetPendingCheckins.resolvedAt),
            ),
          );

        if (dismissResult.affectedRows === 0) {
          return res.status(404).json({
            error: "Không tìm thấy hoặc đã được xử lý trước đó",
          });
        }
        res.json({ success: true });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to dismiss pending checkin" });
      }
    },
  );
}
