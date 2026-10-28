import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { users, userBranches, branches } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { getBranchFilter } from "./_helpers.js";

export function registerUserRoutes(app: Express): void {
  app.get("/api/users", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;

      // Admin: xem tất cả. Non-admin: chỉ thấy nhân viên thuộc cơ sở được phân quyền.
      const branchFilter = getBranchFilter(req, users.branchId);
      const result = await db
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenantId), branchFilter));
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

  // ──────────────────────────────────────────────────────────────────────────
  // Quản lý phân quyền cơ sở cho user (user_branches)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Lấy danh sách cơ sở đã phân cho user.
   * Trả về mảng branchIds + thông tin tên cơ sở để frontend hiển thị.
   */
  app.get(
    "/api/users/:id/branches",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
          return res.status(400).json({ error: "ID người dùng không hợp lệ." });
        }

        // Validate user tồn tại + cùng tenant
        const targetUser = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
          .limit(1);

        if (targetUser.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy người dùng." });
        }

        // Lấy danh sách cơ sở đã gán, kèm tên cơ sở
        const result = await db
          .select({
            branchId: userBranches.branchId,
            branchName: branches.name,
            branchCode: branches.code,
          })
          .from(userBranches)
          .innerJoin(branches, eq(userBranches.branchId, branches.id))
          .where(eq(userBranches.userId, userId));

        res.json({
          userId,
          branchIds: result.map((r) => r.branchId),
          branches: result,
        });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch user branches" });
      }
    },
  );

  /**
   * Gán lại danh sách cơ sở cho user (replace-all trong transaction).
   *
   * Body: { branchIds: [1, 3, 5] }
   *
   * - Xóa tất cả record cũ → insert record mới (atomic).
   * - Cập nhật users.branchId = branchIds[0] để backward compatible.
   * - Không cho phép gán cho admin (admin xem tất cả, không cần).
   * - branchIds = [] → xóa hết quyền cơ sở của user.
   */
  app.put(
    "/api/users/:id/branches",
    requireAuth,
    requireRole(["admin"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const userId = parseInt(req.params.id);
        const { branchIds } = req.body;

        if (isNaN(userId)) {
          return res.status(400).json({ error: "ID người dùng không hợp lệ." });
        }

        if (!Array.isArray(branchIds)) {
          return res.status(400).json({ error: "branchIds phải là một mảng." });
        }

        // Parse + loại trùng
        const parsedIds = [...new Set(branchIds.map(Number).filter((id) => !isNaN(id)))];

        // Validate user tồn tại + cùng tenant
        const targetUser = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
          .limit(1);

        if (targetUser.length === 0) {
          return res.status(404).json({ error: "Không tìm thấy người dùng." });
        }

        if (targetUser[0].role === "admin") {
          return res.status(400).json({ error: "Admin có quyền truy cập tất cả cơ sở, không cần phân quyền." });
        }

        // Validate tất cả branchIds thuộc cùng tenant
        if (parsedIds.length > 0) {
          const validBranches = await db
            .select({ id: branches.id })
            .from(branches)
            .where(and(eq(branches.tenantId, tenantId), inArray(branches.id, parsedIds)));

          const validIds = new Set(validBranches.map((b) => b.id));
          const invalidIds = parsedIds.filter((id) => !validIds.has(id));
          if (invalidIds.length > 0) {
            return res.status(400).json({
              error: `Cơ sở không hợp lệ hoặc không thuộc trung tâm: ${invalidIds.join(", ")}`,
            });
          }
        }

        // Transaction: xóa cũ → insert mới → cập nhật users.branchId
        await db.transaction(async (tx) => {
          // Xóa tất cả record cũ
          await tx.delete(userBranches).where(eq(userBranches.userId, userId));

          // Insert record mới (nếu có)
          if (parsedIds.length > 0) {
            await tx.insert(userBranches).values(
              parsedIds.map((branchId) => ({
                userId,
                branchId,
                tenantId,
              })),
            );
          }

          // Backward compatible: cập nhật users.branchId = cơ sở đầu tiên (hoặc null)
          await tx
            .update(users)
            .set({ branchId: parsedIds.length > 0 ? parsedIds[0] : null })
            .where(eq(users.id, userId));
        });

        // Trả về danh sách mới
        const updatedBranches = await db
          .select({
            branchId: userBranches.branchId,
            branchName: branches.name,
            branchCode: branches.code,
          })
          .from(userBranches)
          .innerJoin(branches, eq(userBranches.branchId, branches.id))
          .where(eq(userBranches.userId, userId));

        res.json({
          userId,
          branchIds: updatedBranches.map((r) => r.branchId),
          branches: updatedBranches,
        });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update user branches" });
      }
    },
  );
}
