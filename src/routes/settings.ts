import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { settings } from "../db/schema.js";
import { eq } from "drizzle-orm";

export function registerSettingsRoutes(app: Express): void {
  /**
   * Lấy cấu hình trung tâm.
   *
   * QUAN TRỌNG: Không trả hanetClientSecret ra ngoài — chỉ trả cờ hasHanetSecret
   * để frontend biết đã cấu hình hay chưa. Mọi user đã đăng nhập đều gọi được
   * route này (cần tên + logo để hiển thị sidebar), nên secret PHẢI được lọc.
   */
  app.get("/api/settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let result = await db
        .select()
        .from(settings)
        .where(eq(settings.tenantId, tenantId))
        .limit(1);

      if (result.length === 0) {
        const newSettings = await insertReturning(db, settings, {
          tenantId,
          centerName: "Schooling",
          logoUrl: null,
        });
        const { hanetClientSecret: _secret, ...safeData } = newSettings as Record<string, unknown>;
        return res.json({ ...safeData, hasHanetSecret: false });
      }

      const row = result[0];
      const { hanetClientSecret: _secret, ...safeData } = row as Record<string, unknown>;
      res.json({ ...safeData, hasHanetSecret: !!_secret });
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  /**
   * Cập nhật thông tin chung (tên, logo).
   * Không cho phép cập nhật secret qua route này — dùng route riêng bên dưới.
   */
  app.put(
    "/api/settings",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { centerName, logoUrl } = req.body;

        let result = await db
          .select()
          .from(settings)
          .where(eq(settings.tenantId, tenantId))
          .limit(1);

        let row;
        if (result.length === 0) {
          row = await insertReturning(db, settings, {
            tenantId,
            centerName,
            logoUrl,
          });
        } else {
          const updatedSettings = await updateReturning(
            db,
            settings,
            { centerName, logoUrl, updatedAt: new Date() },
            eq(settings.tenantId, tenantId),
          );
          row = updatedSettings[0];
        }

        const { hanetClientSecret: _secret, ...safeData } = row as Record<string, unknown>;
        res.json({ ...safeData, hasHanetSecret: !!_secret });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update settings" });
      }
    },
  );

  /**
   * Cập nhật Hanet Client Secret — route riêng, chỉ admin.
   *
   * Tách khỏi PUT /api/settings chung vì:
   * 1. Secret nhạy cảm, chỉ admin được đụng
   * 2. Tránh vô tình ghi đè secret khi sửa tên/logo
   * 3. Frontend gửi secret riêng, không trộn lẫn với form settings
   *
   * Body: { clientSecret: "abc123..." }
   * Gửi clientSecret = "" hoặc null để xóa cấu hình.
   */
  app.put(
    "/api/settings/hanet-secret",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { clientSecret } = req.body;

        if (
          clientSecret !== undefined &&
          clientSecret !== null &&
          typeof clientSecret !== "string"
        ) {
          return res
            .status(400)
            .json({ error: "Client Secret phải là chuỗi ký tự." });
        }

        // Chuỗi rỗng hoặc chỉ khoảng trắng → null (xóa cấu hình)
        const normalizedSecret = clientSecret?.trim() || null;

        let existing = await db
          .select()
          .from(settings)
          .where(eq(settings.tenantId, tenantId))
          .limit(1);

        if (existing.length === 0) {
          await insertReturning(db, settings, {
            tenantId,
            centerName: "Schooling",
            logoUrl: null,
            hanetClientSecret: normalizedSecret,
          });
        } else {
          await updateReturning(
            db,
            settings,
            { hanetClientSecret: normalizedSecret, updatedAt: new Date() },
            eq(settings.tenantId, tenantId),
          );
        }
        globalThis.__hanetSecretCache = undefined;
        res.json({
          success: true,
          hasHanetSecret: !!normalizedSecret,
        });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update Hanet secret" });
      }
    },
  );
}
