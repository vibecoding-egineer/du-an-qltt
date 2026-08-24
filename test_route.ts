import "dotenv/config";
import { db } from "./src/db/index.js";
import { students, classEnrollments, classes } from "./src/db/schema.js";
import { eq, and, inArray } from "drizzle-orm";

export async function getStudentsMock(classId: number) {
    const tenantId = "40MpfjCZT5WXh3R3HesbPJOHaF72";
    let allowedClassIds = null;

    const conditions = [eq(classEnrollments.tenantId, tenantId)];
    if (classId) {
        conditions.push(eq(classEnrollments.classId, classId));
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
    }));
    return result;
}

getStudentsMock(5).then(res => {
    console.log("Mock API returned:", res);
    process.exit(0);
});
