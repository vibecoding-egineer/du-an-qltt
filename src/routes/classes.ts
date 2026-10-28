import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { classes, classEnrollments } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { getBranchFilter } from "./_helpers.js";

export function registerClassRoutes(app: Express): void {
  app.get("/api/classes", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;

      // Teacher: chỉ thấy lớp mình dạy.
      // Admin: tất cả. Non-admin: lọc theo cơ sở được phân quyền.
      const conditions = [eq(classes.tenantId, tenantId), eq(classes.isDeleted, false)];
      if (req.dbUser?.role === "teacher") {
        conditions.push(eq(classes.teacherId, req.dbUser.id));
      } else {
        const branchFilter = getBranchFilter(req, classes.branchId);
        if (branchFilter) conditions.push(branchFilter);
      }
      const classesData = await db
        .select()
        .from(classes)
        .where(and(...conditions));
      const allEnrollments = await db
        .select({ classId: classEnrollments.classId })
        .from(classEnrollments)
        .where(
          and(
            eq(classEnrollments.tenantId, tenantId),
            eq(classEnrollments.isDeleted, false),
          ),
        );

      const result = classesData.map((c) => {
        const studentCount = allEnrollments.filter(
          (s) => s.classId === c.id,
        ).length;
        return { ...c, studentCount };
      });
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch classes" });
    }
  });

  app.post(
    "/api/classes",
    requireAuth,
    requireRole(["admin", "manager", "staff"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        let {
          branchId,
          name,
          program,
          tuition,
          teacherId,
          sessionsPerMonth,
          feeMethod,
        } = req.body;

        // Non-admin: branchId phải nằm trong danh sách cơ sở được phân quyền.
        if (req.dbUser?.role !== "admin") {
          const ids = req.allowedBranchIds;
          if (!ids || ids.length === 0) {
            return res.status(403).json({
              error: "Bạn chưa được phân quyền vào cơ sở nào để tạo lớp.",
            });
          }
          const parsedBranchId = parseInt(branchId);
          if (!branchId || isNaN(parsedBranchId) || !ids.includes(parsedBranchId)) {
            return res.status(403).json({
              error: "Bạn không có quyền tạo lớp ở cơ sở này.",
            });
          }
        }

        const result = await insertReturning(db, classes, {
          tenantId,
          branchId: parseInt(branchId),
          teacherId: teacherId ? parseInt(teacherId) : null,
          name,
          program,
          tuition: tuition ? parseInt(tuition) : null,
          sessionsPerMonth: sessionsPerMonth ? parseInt(sessionsPerMonth) : null,
          feeMethod: feeMethod || "per_session",
        });
        res.json(result);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to create class" });
      }
    },
  );

  app.put(
    "/api/classes/:id",
    requireAuth,
    requireRole(["admin", "manager", "staff"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { id } = req.params;
        let {
          branchId,
          name,
          program,
          tuition,
          teacherId,
          sessionsPerMonth,
          feeMethod,
        } = req.body;

        // Non-admin: chỉ sửa lớp thuộc cơ sở mình quản lý,
        // và branchId mới (nếu đổi) cũng phải nằm trong danh sách.
        if (req.dbUser?.role !== "admin") {
          const branchFilter = getBranchFilter(req, classes.branchId);
          const allowed = await db
            .select({ id: classes.id })
            .from(classes)
            .where(
              and(
                eq(classes.tenantId, tenantId),
                branchFilter,
                eq(classes.id, parseInt(id)),
                eq(classes.isDeleted, false),
              ),
            );
          if (allowed.length === 0) {
            return res.status(403).json({
              error: "Bạn không có quyền sửa lớp này.",
            });
          }
          // Validate branchId mới phải trong danh sách được phân quyền
          const parsedBranchId = parseInt(branchId);
          if (!req.allowedBranchIds?.includes(parsedBranchId)) {
            return res.status(403).json({
              error: "Bạn không có quyền chuyển lớp sang cơ sở này.",
            });
          }
        }

        const result = await updateReturning(
          db,
          classes,
          {
            branchId: parseInt(branchId),
            teacherId: teacherId ? parseInt(teacherId) : null,
            name,
            program,
            tuition: tuition ? parseInt(tuition) : null,
            sessionsPerMonth: sessionsPerMonth
              ? parseInt(sessionsPerMonth)
              : null,
            feeMethod: feeMethod || "per_session",
          },
          and(
            eq(classes.id, parseInt(id)),
            eq(classes.tenantId, tenantId),
            eq(classes.isDeleted, false),
          ),
        );
        res.json(result[0]);
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to update class" });
      }
    },
  );

  app.delete(
    "/api/classes/:id",
    requireAuth,
    requireRole(["admin", "manager", "staff"]),
    async (req: AuthRequest, res) => {
      try {
        const tenantId = req.dbUser?.tenantId || req.user!.uid;
        const { id } = req.params;
        const classId = parseInt(id);

        // Non-admin: chỉ xóa lớp thuộc cơ sở mình quản lý.
        if (req.dbUser?.role !== "admin") {
          const branchFilter = getBranchFilter(req, classes.branchId);
          const allowed = await db
            .select({ id: classes.id })
            .from(classes)
            .where(
              and(
                eq(classes.tenantId, tenantId),
                branchFilter,
                eq(classes.id, classId),
                eq(classes.isDeleted, false),
              ),
            );
          if (allowed.length === 0) {
            return res.status(403).json({
              error: "Bạn không có quyền xóa lớp này.",
            });
          }
        }

        const classStudents = await db
          .select({ id: classEnrollments.id })
          .from(classEnrollments)
          .where(
            and(
              eq(classEnrollments.tenantId, tenantId),
              eq(classEnrollments.classId, classId),
              eq(classEnrollments.isDeleted, false),
            ),
          )
          .limit(1);
        if (classStudents.length > 0) {
          return res.status(400).json({
            error: "Không thể xóa lớp học vì đã có học viên đăng ký.",
          });
        }

        const result = await updateReturning(
          db,
          classes,
          { isDeleted: true, deletedAt: new Date() },
          and(
            eq(classes.id, classId),
            eq(classes.tenantId, tenantId),
            eq(classes.isDeleted, false),
          ),
        );
        res.json(result[0] || { success: true });
      } catch (error: unknown) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete class" });
      }
    },
  );
}
