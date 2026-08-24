import re

with open('server.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix line 321: GET /api/classes (Student count)
old_student_count = """      const allStudents = await db.select({ classId: students.classId }).from(students).where(eq(students.tenantId, tenantId));

      const classesWithTeachers = result.map(c => {
         const studentCount = allStudents.filter(s => s.classId === c.id).length;"""

new_student_count = """      const allEnrollments = await db.select({ classId: classEnrollments.classId }).from(classEnrollments).where(eq(classEnrollments.tenantId, tenantId));

      const classesWithTeachers = result.map(c => {
         const studentCount = allEnrollments.filter(s => s.classId === c.id).length;"""
code = code.replace(old_student_count, new_student_count)

# Fix line 421: DELETE /api/classes/:id
old_check = """      const classStudents = await db.select({ id: students.id }).from(students).where(and(eq(students.tenantId, tenantId), eq(students.classId, parseInt(id)))).limit(1);
      if (classStudents.length > 0) {
        return res.status(400).json({ error: "Cannot delete class with existing students." });
      }"""

new_check = """      const classStudents = await db.select({ id: classEnrollments.id }).from(classEnrollments).where(and(eq(classEnrollments.tenantId, tenantId), eq(classEnrollments.classId, parseInt(id)))).limit(1);
      if (classStudents.length > 0) {
        return res.status(400).json({ error: "Cannot delete class with existing students." });
      }"""
code = code.replace(old_check, new_check)

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(code)
