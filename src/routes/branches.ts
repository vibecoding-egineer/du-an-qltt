import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { branches } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export function registerBranchRoutes(app: Express): void {
  app.get("/api/branches", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;

      let query = db
        .select()
        .from(branches)
        .where(eq(branches.tenantId, tenantId)) as any;
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        query = db
          .select()
          .from(branches)
          .where(
            and(eq(branches.tenantId, tenantId), eq(branches.id, req.dbUser.branchId)),
          ) as any;
      }
      const result = await query;
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.post(
    "/api/branches",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { name, code, phone, address } = req.body;
        const result = await insertReturning(db, branches, {
          tenantId,
          name,
          code,
          phone,
          address,
        });
        res.json(result);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to create branch" });
      }
    },
  );

  app.put(
    "/api/branches/:id",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
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
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update branch" });
      }
    },
  );
}
