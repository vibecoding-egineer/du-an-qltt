import "dotenv/config";
import { db } from "./src/db/index.js";
import { students, classEnrollments, classes } from "./src/db/schema.js";
import { eq, and, inArray } from "drizzle-orm";

async function main() {
    const tenantId = "40MpfjCZT5WXh3R3HesbPJOHaF72";
    const classId = 5;
    
    // Simulate what admin logic does
    let allowedClassIds = null;
    // (If not admin, it sets allowedClassIds = [...])

    const conditions = [eq(classEnrollments.tenantId, tenantId)];
    if (classId) {
        conditions.push(eq(classEnrollments.classId, classId));
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

    console.log("Result length:", result.length);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}
main();
