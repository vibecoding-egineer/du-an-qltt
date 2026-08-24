import "dotenv/config";
import express from "express";
import { db } from "./src/db/index.js";
import { students, classEnrollments, classes, attendance } from "./src/db/schema.js";
import { eq, and, inArray, gte, lte, sql } from "drizzle-orm";

const app = express();
app.use(express.json());

// Mock requireAuth
const mockRequireAuth = (req: any, res: any, next: any) => {
    req.user = { uid: '40MpfjCZT5WXh3R3HesbPJOHaF72' };
    req.dbUser = { role: 'admin', tenantId: '40MpfjCZT5WXh3R3HesbPJOHaF72' };
    next();
};

app.get("/api/students", mockRequireAuth, async (req: any, res: any) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user!.uid;
      const { classId, startDate, endDate } = req.query;
      
      let allowedClassIds: number[] | null = null;
      // admin -> allowedClassIds remains null
      
      const conditions = [eq(classEnrollments.tenantId, tenantId)];
      if (classId) {
        conditions.push(eq(classEnrollments.classId, parseInt(classId as string)));
      }
      if (allowedClassIds) {
        conditions.push(inArray(classEnrollments.classId, allowedClassIds));
      }

      const rawResult = await db.select({
        student: students,
        enrollment: classEnrollments
      })
      .from(classEnrollments)
      .innerJoin(students, eq(classEnrollments.studentId, students.id))
      .where(and(...conditions));

      const result = rawResult.map(row => ({
        ...row.student,
        classId: row.enrollment.classId,
        tuitionStatus: row.enrollment.tuitionStatus,
        tuitionOwed: row.enrollment.tuitionOwed,
        tuitionFee: row.enrollment.tuitionFee,
        entryLevel: row.enrollment.entryLevel,
        enrollmentDate: row.enrollment.enrollmentDate,
        enrollmentId: row.enrollment.id
      }));
      
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
});

import request from "supertest";

request(app)
  .get("/api/students?classId=5")
  .expect("Content-Type", /json/)
  .expect(200)
  .end(function(err, res) {
    if (err) throw err;
    console.log("Status:", res.status);
    console.log("Body length:", res.body.length);
    if (res.body.length === 0) console.log(res.body);
    process.exit(0);
  });
