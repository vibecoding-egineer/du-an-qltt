import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { users, licenses } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { getAuth } from "firebase-admin/auth";
import { getOrCreateUser } from "../db/users.js";

export function registerAuthRoutes(app: Express): void {
  // Auth synchronization route
  app.post("/api/auth/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      const dbUser = await getOrCreateUser(user.uid, user.email || "", user.name);
      res.json(dbUser);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(error);
      res.status(500).json({ error: message });
    }
  });

  // Onboarding: create tenant
  app.post("/api/onboarding/create-tenant", async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const token = authHeader.split("Bearer ")[1];

      let decodedToken;
      try {
        decodedToken = await getAuth().verifyIdToken(token);
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }

      const { uid, email, name } = decodedToken;
      const tenantId = uid;

      const { licenseCode } = req.body;
      if (!licenseCode || typeof licenseCode !== "string") {
        return res.status(400).json({ error: "Vui lòng nhập mã kích hoạt." });
      }

      const normalizedCode = licenseCode.trim().toUpperCase();
      const licenseRows = await db
        .select()
        .from(licenses)
        .where(eq(licenses.code, normalizedCode))
        .limit(1);

      const license = licenseRows[0];
      if (!license) {
        return res.status(400).json({ error: "Mã kích hoạt không hợp lệ." });
      }
      if (license.isRevoked) {
        return res.status(400).json({ error: "Mã kích hoạt đã bị thu hồi." });
      }
      if (license.usedAt || license.tenantId) {
        return res.status(400).json({ error: "Mã kích hoạt này đã được sử dụng." });
      }
      if (license.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ error: "Mã kích hoạt đã hết hạn." });
      }

      const result = await db.transaction(async (tx) => {
        const inserted = await insertReturning(tx, users, {
          uid,
          email: email || "",
          name: name || null,
          tenantId,
          role: "admin",
        });

        const [claimResult] = await tx
          .update(licenses)
          .set({ usedAt: new Date(), tenantId })
          .where(
            and(eq(licenses.id, license.id), isNull(licenses.usedAt), isNull(licenses.tenantId)),
          );

        if (claimResult.affectedRows === 0) {
          throw new Error("LICENSE_ALREADY_CLAIMED");
        }

        return inserted;
      });

      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      if (message === "LICENSE_ALREADY_CLAIMED") {
        return res
          .status(400)
          .json({ error: "Mã kích hoạt này vừa được sử dụng. Vui lòng kiểm tra lại." });
      }
      console.error(error);
      res.status(500).json({ error: "Failed to create center" });
    }
  });

  // Onboarding: join tenant
  app.post("/api/onboarding/join-tenant", async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split("Bearer ")[1];

      let decodedToken;
      try {
        decodedToken = await getAuth().verifyIdToken(token);
      } catch {
        return res.status(401).json({ error: "Invalid token" });
      }

      const { inviteCode } = req.body;
      const { uid, email, name } = decodedToken;

      const existingInvite = await db
        .select()
        .from(users)
        .where(eq(users.inviteCode, inviteCode))
        .limit(1);

      if (existingInvite.length === 0) {
        return res.status(404).json({ error: "Mã lời mời không hợp lệ" });
      }

      const user = existingInvite[0];

      const licenseRows = await db
        .select()
        .from(licenses)
        .where(eq(licenses.tenantId, user.tenantId))
        .limit(1);
      const license = licenseRows[0];
      if (!license || license.isRevoked || license.expiresAt.getTime() < Date.now()) {
        return res.status(403).json({
          error:
            "Trung tâm này hiện không hoạt động. Vui lòng liên hệ quản trị viên trung tâm.",
        });
      }

      const result = await updateReturning(
        db,
        users,
        { uid, name: name || user.name || null, inviteCode: null },
        eq(users.id, user.id),
      );

      res.json(result[0]);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to join center" });
    }
  });
}
