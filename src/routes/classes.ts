import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { classes, classEnrollments } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export function registerClassRoutes(app: Express): void {
  app.get("/api/classes", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;

      let query = db
        .select()
        .from(classes)
        .where(
          and(eq(classes.tenantId, tenantId), eq(classes.isDeleted, false)),
        ) as any;
      if (req.dbUser?.role === "teacher") {
        query = db
          .select()
          .from(classes)
          .where(
            and(
              eq(classes.tenantId, tenantId),
              eq(classes.isDeleted, false),
              eq(classes.teacherId, req.dbUser.id),
            ),
          ) as any;
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        query = db
          .select()
          .from(classes)
          .where(
            and(
              eq(classes.tenantId, tenantId),
              eq(classes.isDeleted, false),
              eq(classes.branchId, req.dbUser.branchId),
            ),
          ) as any;
      }
      const classesData = await query;
      const allEnrollments = await db
        .select({ classId: classEnrollments.classId })
        .from(classEnrollments)
        .where(
          and(
            eq(classEnrollments.tenantId, tenantId),
            eq(classEnrollments.isDeleted, false),
          ),
        );

      const result = classesData.map((c: any) => {
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

        if (req.dbUser?.role !== "admin") {
          if (!req.dbUser?.branchId) {
            return res.status(403).json({
              error: "You must be assigned to a branch to create classes.",
            });
          }
          branchId = req.dbUser.branchId;
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

        if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
          const allowed = await db
            .select({ id: classes.id })
            .from(classes)
            .where(
              and(
                eq(classes.tenantId, tenantId),
                eq(classes.branchId, req.dbUser.branchId),
                eq(classes.id, parseInt(id)),
                eq(classes.isDeleted, false),
              ),
            );
          if (allowed.length === 0) {
            return res.status(403).json({
              error: "Forbidden: Cannot edit class in this branch",
            });
          }
          branchId = req.dbUser.branchId;
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

        if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
          const allowed = await db
            .select({ id: classes.id })
            .from(classes)
            .where(
              and(
                eq(classes.tenantId, tenantId),
                eq(classes.branchId, req.dbUser.branchId),
                eq(classes.id, classId),
                eq(classes.isDeleted, false),
              ),
            );
          if (allowed.length === 0) {
            return res.status(403).json({
              error: "Forbidden: Cannot delete class in this branch",
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
