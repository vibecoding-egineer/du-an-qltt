/**
 * Loại lương (salary_types) — CRUD
 *
 * Dùng chung cho tất cả cơ sở trong cùng 1 tenant.
 * 4 hình thức: fixed (cố định/tháng), percentage (% học phí),
 *              per_shift (theo ca), per_hour (theo giờ).
 *
 * Phân quyền:
 *   - GET: mọi user đã đăng nhập (nhân viên cần xem lương của mình)
 *   - POST/PUT/DELETE: chỉ admin hoặc user có permission "/payroll"
 */
import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { salaryTypes } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

/** 4 loại lương hợp lệ */
const VALID_SALARY_TYPES = ["fixed", "percentage", "per_shift", "per_hour"] as const;
type SalaryType = (typeof VALID_SALARY_TYPES)[number];

function isSalaryType(value: unknown): value is SalaryType {
  return typeof value === "string" && VALID_SALARY_TYPES.includes(value as SalaryType);
}

export function registerSalaryTypeRoutes(app: Express): void {
  // ── GET: danh sách loại lương (không lọc branch — dùng chung) ──
  app.get("/api/salary-types", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const result = await db
        .select()
        .from(salaryTypes)
        .where(and(eq(salaryTypes.tenantId, tenantId), eq(salaryTypes.isDeleted, false)))
        .orderBy(salaryTypes.createdAt);
      res.json(result);
    } catch (error: unknown) {
      console.error("GET /api/salary-types error:", error);
      res.status(500).json({ error: "Không thể tải danh sách loại lương." });
    }
  });

  // ── POST: tạo loại lương mới ──
  app.post(
    "/api/salary-types",
    requireAuth,
    requirePermission("/payroll"),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { name, type, amount } = req.body;

        // Validation: tên
        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Vui lòng nhập tên loại lương." });
        }

        // Validation: type
        if (!isSalaryType(type)) {
          return res.status(400).json({
            error: `Loại lương không hợp lệ. Chỉ chấp nhận: ${VALID_SALARY_TYPES.join(", ")}.`,
          });
        }

        // Validation: amount
        const parsedAmount = Number(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
          return res.status(400).json({ error: "Số tiền/tỷ lệ phải là số không âm." });
        }
        if (type === "percentage" && parsedAmount > 100) {
          return res.status(400).json({ error: "Tỷ lệ phần trăm không được vượt quá 100%." });
        }

        const result = await insertReturning(db, salaryTypes, {
          tenantId,
          name: name.trim(),
          type,
          amount: String(parsedAmount), // Drizzle decimal nhận string
        });
        res.json(result);
      } catch (error: unknown) {
        console.error("POST /api/salary-types error:", error);
        res.status(500).json({ error: "Không thể tạo loại lương." });
      }
    },
  );

  // ── PUT: cập nhật loại lương ──
  app.put(
    "/api/salary-types/:id",
    requireAuth,
    requirePermission("/payroll"),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const salaryTypeId = parseInt(req.params.id);
        const { name, type, amount } = req.body;

        if (isNaN(salaryTypeId)) {
          return res.status(400).json({ error: "ID không hợp lệ." });
        }

        // Validation: tên
        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Vui lòng nhập tên loại lương." });
        }

        // Validation: type
        if (!isSalaryType(type)) {
          return res.status(400).json({
            error: `Loại lương không hợp lệ. Chỉ chấp nhận: ${VALID_SALARY_TYPES.join(", ")}.`,
          });
        }

        // Validation: amount
        const parsedAmount = Number(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
          return res.status(400).json({ error: "Số tiền/tỷ lệ phải là số không âm." });
        }
        if (type === "percentage" && parsedAmount > 100) {
          return res.status(400).json({ error: "Tỷ lệ phần trăm không được vượt quá 100%." });
        }

        const result = await updateReturning(
          db,
          salaryTypes,
          {
            name: name.trim(),
            type,
            amount: String(parsedAmount),
          },
          and(
            eq(salaryTypes.id, salaryTypeId),
            eq(salaryTypes.tenantId, tenantId),
            eq(salaryTypes.isDeleted, false),
          ),
        );

        if (result.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy loại lương." });
        }
        res.json(result[0]);
      } catch (error: unknown) {
        console.error("PUT /api/salary-types/:id error:", error);
        res.status(500).json({ error: "Không thể cập nhật loại lương." });
      }
    },
  );

  // ── DELETE: xóa mềm loại lương ──
  app.delete(
    "/api/salary-types/:id",
    requireAuth,
    requirePermission("/payroll"),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const salaryTypeId = parseInt(req.params.id);

        if (isNaN(salaryTypeId)) {
          return res.status(400).json({ error: "ID không hợp lệ." });
        }

        const result = await updateReturning(
          db,
          salaryTypes,
          { isDeleted: true, deletedAt: new Date() },
          and(
            eq(salaryTypes.id, salaryTypeId),
            eq(salaryTypes.tenantId, tenantId),
            eq(salaryTypes.isDeleted, false),
          ),
        );

        if (result.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy loại lương." });
        }
        res.json({ success: true });
      } catch (error: unknown) {
        console.error("DELETE /api/salary-types/:id error:", error);
        res.status(500).json({ error: "Không thể xóa loại lương." });
      }
    },
  );
}
