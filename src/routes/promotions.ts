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
      await db.update(promotions).set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(promotions.id, promoId), eq(promotions.tenantId, tenantId), eq(promotions.isDeleted, false)));
      res.json({ success: true });
    } catch (error) {
      console.error("Lỗi xóa ưu đãi:", error);
      res.status(500).json({ error: "Lỗi máy chủ" });
    }
  });
}
