import "dotenv/config";
import { db } from "./src/db/index.js";
import { students, classEnrollments } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
    const res = await db.select({
        student: students,
        enrollment: classEnrollments
    }).from(classEnrollments).innerJoin(students, eq(classEnrollments.studentId, students.id)).limit(1);
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}
main();
