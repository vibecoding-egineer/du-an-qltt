import "dotenv/config";
import { db } from "./src/db/index.js";
import { students, classEnrollments, classes, attendance } from "./src/db/schema.js";
import { eq, and, inArray, gte, lte, sql } from "drizzle-orm";

async function main() {
    const tenantId = "40MpfjCZT5WXh3R3HesbPJOHaF72";
    const classId = 5;
    
    // Simulate what admin logic does
    let allowedClassIds = null;

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
    
    let filterStartDate = new Date();
    let filterEndDate = new Date();
    filterStartDate.setDate(1);
    filterStartDate.setHours(0, 0, 0, 0);
    filterEndDate.setMonth(filterEndDate.getMonth() + 1);
    filterEndDate.setDate(0);
    filterEndDate.setHours(23, 59, 59, 999);
    
    const studentIds = result.map((s: any) => s.id);
    let attendanceCounts: Record<number, number> = {};
    if (studentIds.length > 0) {
        const attendanceRecords = await db.select({
            studentId: attendance.studentId,
            count: sql`count(${attendance.id})`.mapWith(Number)
        })
        .from(attendance)
        .where(
            and(
            eq(attendance.tenantId, tenantId),
            inArray(attendance.studentId, studentIds),
            eq(attendance.status, 'present'),
            gte(attendance.date, filterStartDate),
            lte(attendance.date, filterEndDate)
            )
        )
        .groupBy(attendance.studentId);
        
        attendanceRecords.forEach(record => {
            if (record.studentId) attendanceCounts[record.studentId] = record.count;
        });
    }
    
    const mappedResult = result.map((student: any) => ({
        ...student,
        attendedSessionsCount: attendanceCounts[student.id] || 0
    }));

    console.log(JSON.stringify(mappedResult, null, 2));
    process.exit(0);
}
main();
