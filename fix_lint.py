import re

with open('server.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix import
code = code.replace("transactions, promotions } from \"./src/db/schema.js\";", "transactions, promotions, classEnrollments } from \"./src/db/schema.js\";")

# Fix line 321
code = code.replace("const allStudents = await db.select({ classId: students.classId }).from(students)", "const allEnrollments = await db.select({ classId: classEnrollments.classId }).from(classEnrollments)")
code = code.replace("const studentCount = allStudents.filter(s => s.classId === c.id).length;", "const studentCount = allEnrollments.filter(s => s.classId === c.id).length;")

# Fix line 421
code = code.replace("const classStudents = await db.select({ id: students.id }).from(students).where(and(eq(students.tenantId, tenantId), eq(students.classId, parseInt(id)))).limit(1);", "const classStudents = await db.select({ id: classEnrollments.id }).from(classEnrollments).where(and(eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.classId, parseInt(id)))).limit(1);")

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(code)
