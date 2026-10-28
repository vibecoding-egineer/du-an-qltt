/**
 * CRUD API cho bảng camera_devices — mapping camera Hanet (placeName/deviceID) với cơ sở.
 *
 * Chỉ admin được thêm/sửa/xóa. Mọi user đã đăng nhập được xem danh sách
 * (cần cho UI hiển thị tên cơ sở trên trang camera).
 *
 * Soft delete theo chuẩn dự án — generated column `activeNameDevice` đảm bảo
 * unique constraint chỉ áp dụng cho dòng chưa bị xóa.
 */
import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { cameraDevices, branches } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { getBranchFilter } from "./_helpers.js";

export function registerCameraDeviceRoutes(app: Express): void {
  /**
   * Liệt kê mapping camera ↔ cơ sở của tenant.
   * Join bảng branches để trả luôn tên cơ sở, tránh frontend phải gọi thêm API.
   */
  app.get(
    "/api/camera-devices",
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;

        // Non-admin chỉ thấy camera thuộc cơ sở được phân quyền
        const branchFilter = getBranchFilter(req, cameraDevices.branchId);

        const result = await db
          .select({
            id: cameraDevices.id,
            tenantId: cameraDevices.tenantId,
            branchId: cameraDevices.branchId,
            placeId: cameraDevices.placeId,
            placeName: cameraDevices.placeName,
            deviceId: cameraDevices.deviceId,
            deviceName: cameraDevices.deviceName,
            createdAt: cameraDevices.createdAt,
            branchName: branches.name,
            branchCode: branches.code,
          })
          .from(cameraDevices)
          .leftJoin(branches, eq(cameraDevices.branchId, branches.id))
          .where(
            and(
              eq(cameraDevices.tenantId, tenantId),
              eq(cameraDevices.isDeleted, false),
              branchFilter,
            ),
          );

        res.json(result);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Không thể tải danh sách camera" });
      }
    },
  );

  /**
   * Thêm mapping mới: gắn camera vào cơ sở bằng placeName và/hoặc deviceID.
   *
   * Body: { placeName?, deviceId?, deviceName?, placeId?, branchId }
   *
   * Validate:
   * - Ít nhất một trong placeName / deviceId là bắt buộc
   * - branchId bắt buộc, phải thuộc cùng tenant
   * - placeId tùy chọn (webhook sẽ tự điền khi match)
   * - Không cho trùng mapping active (database tự chặn qua unique index)
   */
  app.post(
    "/api/camera-devices",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { placeId, placeName, deviceId, deviceName, branchId } = req.body;

        // --- Validation ---
        const trimmedPlaceName = typeof placeName === "string" ? placeName.trim() : "";
        const trimmedDeviceId = typeof deviceId === "string" ? deviceId.trim() : "";

        if (!trimmedPlaceName && !trimmedDeviceId) {
          return res
            .status(400)
            .json({ error: "Phải nhập ít nhất Tên địa điểm hoặc Serial camera." });
        }

        if (!branchId || isNaN(parseInt(branchId))) {
          return res
            .status(400)
            .json({ error: "Cơ sở (branchId) là bắt buộc." });
        }

        const parsedBranchId = parseInt(branchId);

        // Kiểm tra branch thuộc cùng tenant
        const branchRows = await db
          .select({ id: branches.id })
          .from(branches)
          .where(
            and(
              eq(branches.id, parsedBranchId),
              eq(branches.tenantId, tenantId),
            ),
          )
          .limit(1);

        if (branchRows.length === 0) {
          return res
            .status(400)
            .json({ error: "Cơ sở không tồn tại hoặc không thuộc trung tâm của bạn." });
        }

        const trimmedPlaceId = typeof placeId === "string" ? placeId.trim() : null;

        const result = await insertReturning(db, cameraDevices, {
          tenantId,
          branchId: parsedBranchId,
          placeId: trimmedPlaceId || null,
          placeName: trimmedPlaceName || null,
          deviceId: trimmedDeviceId || null,
          deviceName: deviceName?.trim() || null,
        });

        res.json(result);
      } catch (error: unknown) {
        // Bắt lỗi trùng unique (generated column)
        const message = error instanceof Error ? error.message : "";
        const errObj = error as Record<string, unknown>;
        const isDuplicateKey =
          errObj?.code === "ER_DUP_ENTRY" ||
          errObj?.errno === 1062 ||
          message.includes("Duplicate entry");

        if (isDuplicateKey) {
          return res.status(400).json({
            error:
              "Mapping này đã tồn tại. Mỗi Tên địa điểm + Serial camera chỉ được gắn một lần.",
          });
        }

        console.error(error);
        res.status(500).json({ error: "Không thể thêm mapping camera" });
      }
    },
  );

  /**
   * Cập nhật mapping: đổi placeName, deviceId, cơ sở.
   *
   * Body: { placeName?, deviceId?, deviceName?, branchId? }
   * Tất cả các trường đều tùy chọn — chỉ cập nhật trường được gửi.
   */
  app.put(
    "/api/camera-devices/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const deviceMappingId = parseInt(req.params.id);
        const { placeName, deviceId, deviceName, branchId } = req.body;

        if (isNaN(deviceMappingId)) {
          return res.status(400).json({ error: "ID không hợp lệ." });
        }

        // Xây dựng object cập nhật — chỉ cập nhật trường được gửi
        const updateData: Record<string, unknown> = {};

        if (placeName !== undefined) {
          updateData.placeName = placeName?.trim() || null;
        }
        if (deviceId !== undefined) {
          updateData.deviceId = deviceId?.trim() || null;
        }
        if (deviceName !== undefined) {
          updateData.deviceName = deviceName?.trim() || null;
        }

        if (branchId !== undefined) {
          if (!branchId || isNaN(parseInt(branchId))) {
            return res
              .status(400)
              .json({ error: "branchId không hợp lệ." });
          }
          const parsedBranchId = parseInt(branchId);

          // Kiểm tra branch thuộc cùng tenant
          const branchRows = await db
            .select({ id: branches.id })
            .from(branches)
            .where(
              and(
                eq(branches.id, parsedBranchId),
                eq(branches.tenantId, tenantId),
              ),
            )
            .limit(1);

          if (branchRows.length === 0) {
            return res
              .status(400)
              .json({ error: "Cơ sở không tồn tại hoặc không thuộc trung tâm của bạn." });
          }

          updateData.branchId = parsedBranchId;
        }

        if (Object.keys(updateData).length === 0) {
          return res
            .status(400)
            .json({ error: "Không có trường nào cần cập nhật." });
        }

        const result = await updateReturning(
          db,
          cameraDevices,
          updateData,
          and(
            eq(cameraDevices.id, deviceMappingId),
            eq(cameraDevices.tenantId, tenantId),
            eq(cameraDevices.isDeleted, false),
          ),
        );

        if (result.length === 0) {
          return res
            .status(404)
            .json({ error: "Không tìm thấy mapping camera này." });
        }

        res.json(result[0]);
      } catch (error: unknown) {
        // Bắt lỗi trùng unique khi đổi placeName/deviceId trùng mapping khác
        const message = error instanceof Error ? error.message : "";
        const errObj = error as Record<string, unknown>;
        const isDuplicateKey =
          errObj?.code === "ER_DUP_ENTRY" ||
          errObj?.errno === 1062 ||
          message.includes("Duplicate entry");

        if (isDuplicateKey) {
          return res.status(400).json({
            error:
              "Mapping này đã tồn tại. Mỗi Tên địa điểm + Serial camera chỉ được gắn một lần.",
          });
        }

        console.error(error);
        res.status(500).json({ error: "Không thể cập nhật mapping camera" });
      }
    },
  );

  /**
   * Xóa mềm mapping camera.
   */
  app.delete(
    "/api/camera-devices/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const deviceMappingId = parseInt(req.params.id);

        if (isNaN(deviceMappingId)) {
          return res.status(400).json({ error: "ID không hợp lệ." });
        }

        const result = await updateReturning(
          db,
          cameraDevices,
          { isDeleted: true, deletedAt: new Date() },
          and(
            eq(cameraDevices.id, deviceMappingId),
            eq(cameraDevices.tenantId, tenantId),
            eq(cameraDevices.isDeleted, false),
          ),
        );

        if (result.length === 0) {
          return res
            .status(404)
            .json({ error: "Không tìm thấy mapping camera này." });
        }

        res.json({ success: true });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Không thể xóa mapping camera" });
      }
    },
  );
}
