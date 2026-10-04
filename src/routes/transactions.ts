import type { Express } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { db } from "../db/index.js";
import { insertReturning, updateReturning } from "../db/helpers.js";
import { transactions, students } from "../db/schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export function registerTransactionRoutes(app: Express): void {
  app.get("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { branchId, type, category, startDate, endDate } = req.query;

      let conditions = [eq(transactions.tenantId, tenantId), eq(transactions.isDeleted, false)];
      if (branchId) conditions.push(eq(transactions.branchId, parseInt(branchId as string)));
      if (type) conditions.push(eq(transactions.type, type as string));
      if (category) conditions.push(eq(transactions.category, category as string));
      if (startDate && endDate) {
        conditions.push(gte(transactions.date, new Date(startDate as string)));
        conditions.push(lte(transactions.date, new Date(endDate as string)));
      }

      const data = await db
        .select({
          id: transactions.id,
          type: transactions.type,
          category: transactions.category,
          amount: transactions.amount,
          date: transactions.date,
          note: transactions.note,
          studentId: transactions.studentId,
          studentName: students.name,
        })
        .from(transactions)
        .leftJoin(students, eq(transactions.studentId, students.id))
        .where(and(...conditions))
        .orderBy(desc(transactions.date));

      res.json(data);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", requireAuth, requireRole(["admin", "manager", "staff"]), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      let { branchId, type, category, amount, date, note, studentId } = req.body;

      if (req.dbUser?.role !== "admin") {
        if (!req.dbUser?.branchId) {
          return res.status(403).json({ error: "You must be assigned to a branch to create transactions." });
        }
        branchId = req.dbUser.branchId;
      }

      const result = await insertReturning(db, transactions, {
        tenantId,
        branchId: branchId ? parseInt(branchId) : null,
        type, category,
        amount: parseInt(amount),
        date: date ? new Date(date) : new Date(),
        note,
        studentId: studentId ? parseInt(studentId) : null,
      });
      res.json(result);
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  app.delete("/api/transactions/:id", requireAuth, requireRole(["admin", "manager", "staff"]), async (req: AuthRequest, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const result = await updateReturning(db, transactions, { isDeleted: true, deletedAt: new Date() }, and(eq(transactions.id, parseInt(req.params.id)), eq(transactions.tenantId, tenantId), eq(transactions.isDeleted, false)));
      res.json(result[0] || { success: true });
    } catch (error: unknown) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });
}
