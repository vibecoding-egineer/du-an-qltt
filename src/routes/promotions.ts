import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { promotions } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

export function registerPromotionRoutes(app: Express): void {
  app.get("/api/promotions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const result = await db.select().from(promotions).where(and(eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false))).orderBy(desc(promotions.createdAt));

      // Non-admin: chỉ trả promotions có ít nhất 1 branchId thuộc cơ sở được phân quyền
      if (req.dbUser?.role !== "admin") {
        const ids = req.allowedBranchIds;
        if (!ids || ids.length === 0) return res.json([]);
        const filtered = result.filter((promo) => {
          const promoBranches = promo.branchIds;
          if (!promoBranches || promoBranches.length === 0) return false;
          return promoBranches.some((bid) => ids.includes(bid));
        });
        return res.json(filtered);
      }

      res.json(result);
    } catch (error) {
      console.error("Lỗi lấy danh sách ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  app.post("/api/promotions", requireAuth, requirePermission("/promotions"), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { name, discountType, discountValue, branchIds, startDate, endDate, isActive } = req.body;

      if (discountType === "percentage" && discountValue > 100) {
        return res.status(400).json({ error: "Phần trăm giảm giá không được vượt quá 100" });
      }

      // Non-admin: validate tất cả branchIds nằm trong cơ sở được phân quyền
      if (req.dbUser?.role !== "admin") {
        const ids = req.allowedBranchIds;
        if (!ids || ids.length === 0) {
          return res.status(403).json({ error: "Bạn chưa được phân quyền vào cơ sở nào để tạo ưu đãi." });
        }
        const parsedBranchIds = Array.isArray(branchIds) ? branchIds.map(Number) : [];
        const unauthorized = parsedBranchIds.filter((bid) => !ids.includes(bid));
        if (unauthorized.length > 0) {
          return res.status(403).json({ error: "Bạn không có quyền tạo ưu đãi cho một số cơ sở đã chọn." });
        }
      }

      const newPromo = await insertReturning(db, promotions, {
        tenantId, name, discountType, discountValue, branchIds,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : true,
      });
      res.json(newPromo);
    } catch (error) {
      console.error("Lỗi tạo ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  app.put("/api/promotions/:id", requireAuth, requirePermission("/promotions"), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const promoId = parseInt(req.params.id);
      const { name, discountType, discountValue, branchIds, startDate, endDate, isActive } = req.body;

      if (discountType === "percentage" && discountValue > 100) {
        return res.status(400).json({ error: "Phần trăm giảm giá không được vượt quá 100" });
      }

      // Non-admin: check promotion hiện tại thuộc cơ sở mình + branchIds mới cũng hợp lệ
      if (req.dbUser?.role !== "admin") {
        const ids = req.allowedBranchIds;
        if (!ids || ids.length === 0) {
          return res.status(403).json({ error: "Bạn chưa được phân quyền vào cơ sở nào." });
        }
        // Check promotion hiện tại
        const existing = await db
          .select({ branchIds: promotions.branchIds })
          .from(promotions)
          .where(and(eq(promotions.id, promoId), eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false)))
          .limit(1);
        if (existing.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy ưu đãi" });
        }
        const existingBranches = existing[0].branchIds || [];
        const unauthorizedExisting = existingBranches.filter((bid) => !ids.includes(bid));
        if (unauthorizedExisting.length > 0) {
          return res.status(403).json({ error: "Bạn không có quyền sửa ưu đãi thuộc cơ sở khác." });
        }
        // Check branchIds mới
        if (branchIds) {
          const parsedNewBranches = Array.isArray(branchIds) ? branchIds.map(Number) : [];
          const unauthorizedNew = parsedNewBranches.filter((bid) => !ids.includes(bid));
          if (unauthorizedNew.length > 0) {
            return res.status(403).json({ error: "Bạn không có quyền gán ưu đãi cho một số cơ sở đã chọn." });
          }
        }
      }

      const [updatedPromo] = await updateReturning(db, promotions, {
        name, discountType, discountValue, branchIds,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive, updatedAt: new Date(),
      }, and(eq(promotions.id, promoId), eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false)));

      if (!updatedPromo) return res.status(404).json({ error: "Không tìm thấy ưu đãi" });
      res.json(updatedPromo);
    } catch (error) {
      console.error("Lỗi cập nhật ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });

  app.delete("/api/promotions/:id", requireAuth, requirePermission("/promotions"), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const promoId = parseInt(req.params.id);

      // Non-admin: check promotion thuộc cơ sở được phân quyền
      if (req.dbUser?.role !== "admin") {
        const ids = req.allowedBranchIds;
        if (!ids || ids.length === 0) {
          return res.status(403).json({ error: "Bạn chưa được phân quyền vào cơ sở nào." });
        }
        const existing = await db
          .select({ branchIds: promotions.branchIds })
          .from(promotions)
          .where(and(eq(promotions.id, promoId), eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false)))
          .limit(1);
        if (existing.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy ưu đãi." });
        }
        const promoBranches = existing[0].branchIds || [];
        const unauthorized = promoBranches.filter((bid) => !ids.includes(bid));
        if (unauthorized.length > 0) {
          return res.status(403).json({ error: "Bạn không có quyền xóa ưu đãi thuộc cơ sở khác." });
        }
      }

      await db.update(promotions).set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(promotions.id, promoId), eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false)));
      res.json({ success: true });
    } catch (error) {
      console.error("Lỗi xóa ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });
}
