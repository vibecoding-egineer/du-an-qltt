/**
 * Webhook Hanet AI Camera + Hàng đợi check-in chưa xác định được lớp.
 *
 * Route CÔNG KHAI — Hanet gọi trực tiếp từ camera/cloud, KHÔNG có Firebase token
 * nên KHÔNG qua requireAuth. Bảo mật bằng hash = MD5(client_secret + id).
 *
 * MULTI-TENANT: Duyệt toàn bộ tenant đã cấu hình Client Secret trong DB, tìm
 * tenant có secret khớp hash. Cache 5 phút để giảm tải DB.
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
  cameraDevices,
  branches,
  settings,
} from "../db/schema.js";
import { eq, and, gte, lte, inArray, desc, isNull, isNotNull, sql } from "drizzle-orm";
import {
  verifyHanetHash,
  parseHanetTime,
  HANET_RECOGNIZED_PERSON_TYPES,
  type HanetWebhookPayload,
} from "../lib/hanet.js";
import { getBranchFilter, HANET_SESSION_EXPIRY_HOURS } from "./_helpers.js";

/* ================================================================
 * Cache Secret multi-tenant
 * ================================================================
 * - Lưu Map<tenantId, clientSecret> trong globalThis
 * - Tự hết hạn sau 5 phút
 * - Bị xóa ngay khi admin cập nhật secret (settings route set
 *   globalThis.__hanetSecretCache = undefined)
 * ================================================================ */

interface HanetSecretCache {
  secrets: Map<string, string>;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __hanetSecretCache: HanetSecretCache | undefined;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

async function getHanetSecrets(): Promise<Map<string, string>> {
  const now = Date.now();
  const cache = globalThis.__hanetSecretCache;

  if (cache && now < cache.expiresAt) {
    return cache.secrets;
  }

  const rows = await db
    .select({
      tenantId: settings.tenantId,
      hanetClientSecret: settings.hanetClientSecret,
    })
    .from(settings);

  const secrets = new Map<string, string>();
  const seenSecrets = new Map<string, string>();

  for (const row of rows) {
    if (row.hanetClientSecret) {
      const existingTenant = seenSecrets.get(row.hanetClientSecret);
      if (existingTenant) {
        console.error(
          `[HANET] CẢNH BÁO: Tenant "${row.tenantId}" trùng Client Secret với "${existingTenant}". ` +
            `Webhook sẽ không thể phân biệt — hãy đổi secret của một bên.`,
        );
      } else {
        seenSecrets.set(row.hanetClientSecret, row.tenantId);
      }
      secrets.set(row.tenantId, row.hanetClientSecret);
    }
  }

  globalThis.__hanetSecretCache = { secrets, expiresAt: now + CACHE_TTL_MS };
  return secrets;
}

/**
 * Tìm tất cả tenant có secret khớp hash. Nếu >1 match → trùng secret,
 * phải từ chối để tránh ghi nhầm dữ liệu.
 */
function findMatchingTenants(
  recordId: string,
  hash: string,
  secrets: Map<string, string>,
): string[] {
  const matches: string[] = [];
  for (const [tenantId, secret] of secrets) {
    if (verifyHanetHash(recordId, hash, secret)) {
      matches.push(tenantId);
    }
  }
  return matches;
}

/* ================================================================
 * Routes
 * ================================================================ */

export function registerHanetRoutes(app: Express): void {
  /* ===== Webhook chính — công khai, Hanet gọi ===== */

  app.post("/api/webhooks/hanet", async (req, res) => {
    try {
      const payload = req.body as HanetWebhookPayload;

      console.error("[HANET] FULL payload:", JSON.stringify(req.body));

      /* --- Xác thực multi-tenant --- */

      const secrets = await getHanetSecrets();

      if (secrets.size === 0) {
        console.error(
          "[HANET] Chưa có tenant nào cấu hình Client Secret trong DB.",
        );
        return res.status(200).json({ received: true, processed: false });
      }

      const matchedTenants = findMatchingTenants(
        payload.id,
        payload.hash,
        secrets,
      );

      if (matchedTenants.length === 0) {
        console.warn("[HANET] Hash không khớp với bất kỳ tenant nào.", {
          id: payload.id,
        });
        return res.status(401).json({ error: "Invalid signature" });
      }

      if (matchedTenants.length > 1) {
        console.error(
          "[HANET] Hash khớp với NHIỀU tenant — không thể phân biệt. " +
            "Kiểm tra trùng Client Secret.",
          matchedTenants,
        );
        return res.status(500).json({ error: "Ambiguous tenant match" });
      }

      const tenantId = matchedTenants[0];

      /* --- Tra cứu camera → branchId bằng deviceId hoặc placeName --- */

      let resolvedBranchId: number | null = null;

      const payloadPlaceId = payload.placeID;
      const payloadDeviceId = payload.deviceID;
      const payloadPlaceName = payload.placeName;

      // Ưu tiên 1: Match chính xác theo serial camera (deviceId)
      if (payloadDeviceId) {
        const deviceRows = await db
          .select({
            id: cameraDevices.id,
            branchId: cameraDevices.branchId,
            placeId: cameraDevices.placeId,
          })
          .from(cameraDevices)
          .where(
            and(
              eq(cameraDevices.tenantId, tenantId),
              eq(cameraDevices.deviceId, payloadDeviceId),
              eq(cameraDevices.isDeleted, false),
            ),
          )
          .limit(1);

        if (deviceRows.length > 0) {
          resolvedBranchId = deviceRows[0].branchId;
          // Auto-fill placeId từ webhook nếu mapping chưa có (best-effort)
          if (!deviceRows[0].placeId && payloadPlaceId) {
            db.update(cameraDevices)
              .set({ placeId: payloadPlaceId })
              .where(eq(cameraDevices.id, deviceRows[0].id))
              .catch((err: unknown) =>
                console.error("[HANET] Auto-fill placeId lỗi:", err),
              );
          }
        }
      }

      // Ưu tiên 2: Fallback theo tên địa điểm (placeName, chỉ mapping place-level: deviceId IS NULL)
      if (resolvedBranchId === null && payloadPlaceName) {
        const placeRows = await db
          .select({
            id: cameraDevices.id,
            branchId: cameraDevices.branchId,
            placeId: cameraDevices.placeId,
          })
          .from(cameraDevices)
          .where(
            and(
              eq(cameraDevices.tenantId, tenantId),
              eq(cameraDevices.placeName, payloadPlaceName),
              isNull(cameraDevices.deviceId),
              eq(cameraDevices.isDeleted, false),
            ),
          )
          .limit(1);

        if (placeRows.length > 0) {
          resolvedBranchId = placeRows[0].branchId;
          // Auto-fill placeId từ webhook nếu mapping chưa có (best-effort)
          if (!placeRows[0].placeId && payloadPlaceId) {
            db.update(cameraDevices)
              .set({ placeId: payloadPlaceId })
              .where(eq(cameraDevices.id, placeRows[0].id))
              .catch((err: unknown) =>
                console.error("[HANET] Auto-fill placeId lỗi:", err),
              );
          }
        }
      }

      /* --- Chỉ xử lý sự kiện log (check-in) --- */

      if (payload.data_type !== "log") {
        console.log(
          `[HANET] tenant=${tenantId} data_type="${payload.data_type}" ` +
            `action_type="${payload.action_type}" — ghi nhận, chưa xử lý sâu.`,
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

      /* --- Tra học viên — lọc theo tenantId để không nhầm tenant khác --- */

      const matchedStudents = await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.hanetPersonId, personID),
            eq(students.tenantId, tenantId),
            eq(students.isDeleted, false),
          ),
        )
        .limit(1);

      if (matchedStudents.length === 0) {
        await db
          .insert(hanetPendingCheckins)
          .values({
            tenantId,
            branchId: resolvedBranchId,
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
            branchId: resolvedBranchId,
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
            branchId: resolvedBranchId,
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

  /* ===== Hàng đợi check-in Hanet (đã dùng tenantId từ requireAuth) ===== */

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
            branchId: hanetPendingCheckins.branchId,
            studentName: students.name,
            studentCode: students.studentCode,
            branchName: branches.name,
          })
          .from(hanetPendingCheckins)
          .leftJoin(
            students,
            eq(hanetPendingCheckins.studentId, students.id),
          )
          .leftJoin(
            branches,
            eq(hanetPendingCheckins.branchId, branches.id),
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
        } else if (req.dbUser.role !== "admin") {
          const branchFilter = getBranchFilter(req, classes.branchId);
          const allowed = await db
            .select({ id: classes.id })
            .from(classes)
            .where(
              and(
                eq(classes.tenantId, tenantId),
                branchFilter,
                eq(classes.id, parsedClassId),
              ),
            );
          if (allowed.length === 0) {
            return res
              .status(403)
              .json({ error: "Lớp này không thuộc cơ sở của bạn" });
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
        const errObj = error as Record<string, unknown>;
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
