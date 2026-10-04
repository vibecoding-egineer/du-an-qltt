import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { settings } from "../db/schema.js";
import { eq } from "drizzle-orm";

export function registerSettingsRoutes(app: Express): void {
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
        return res.json(newSettings);
      }

      res.json(result[0]);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

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

        if (result.length === 0) {
          const newSettings = await insertReturning(db, settings, {
            tenantId,
            centerName,
            logoUrl,
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
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update settings" });
      }
    },
  );
}
