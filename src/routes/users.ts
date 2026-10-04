import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export function registerUserRoutes(app: Express): void {
  app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let query = db
        .select()
        .from(users)
        .where(eq(users.tenantId, tenantId)) as any;
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        query = db
          .select()
          .from(users)
          .where(
            and(eq(users.tenantId, tenantId), eq(users.branchId, req.dbUser.branchId)),
          ) as any;
      }
      const result = await query;
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post(
    "/api/users",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { email, name, role, employeeCode, branchId, permissions } = req.body;

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (existing.length > 0) {
          return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống." });
        }

        const pendingUid = `pending_${Date.now()}_${email}`;
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await insertReturning(db, users, {
          uid: pendingUid,
          email,
          name: name || null,
          role: role || "staff",
          employeeCode: employeeCode || null,
          branchId: branchId ? parseInt(branchId) : null,
          permissions: permissions || [],
          inviteCode,
          tenantId,
        });

        res.json(result);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to create user" });
      }
    },
  );

  app.put(
    "/api/users/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { id } = req.params;
        const { role, permissions } = req.body;

        const result = await updateReturning(
          db,
          users,
          {
            ...(role && { role }),
            ...(permissions && { permissions }),
          },
          and(eq(users.id, parseInt(id)), eq(users.tenantId, tenantId)),
        );

        if (!result.length) {
          return res.status(404).json({ error: "User not found or unauthorized" });
        }
        res.json(result[0]);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update user" });
      }
    },
  );
}
