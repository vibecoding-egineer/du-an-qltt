import re

with open('server.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# PUT /api/students/:id
put_old = """      const result = await db.update(students)
        .set({
          name,
          phone,
          ...(classId && { classId: parseInt(classId) }),
          ...((tuitionStatus && (req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager')) && { tuitionStatus }),
          ...((req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager') && { tuitionOwed: (tuitionStatus === 'Còn thiếu' && tuitionOwed) ? parseInt(tuitionOwed) : 0 })
        })
        .where(and(eq(students.id, parseInt(id)), eq(students.tenantId, tenantId)))
        .returning();
      res.json(result[0]);"""

put_new = """      const result = await db.update(students)
        .set({ name, phone })
        .where(and(eq(students.id, parseInt(id)), eq(students.tenantId, tenantId)))
        .returning();
        
      if (classId) {
        await db.update(classEnrollments)
          .set({
             ...((tuitionStatus && (req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager')) && { tuitionStatus }),
             ...((req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager') && { tuitionOwed: (tuitionStatus === 'Còn thiếu' && tuitionOwed) ? parseInt(tuitionOwed) : 0 })
          })
          .where(and(eq(classEnrollments.studentId, parseInt(id)), eq(classEnrollments.classId, parseInt(classId))));
      }
      res.json(result[0]);"""
code = code.replace(put_old, put_new)

# DELETE /api/students/:id
delete_old = """      // Delete associated attendance records first
      await db.delete(attendance).where(and(eq(attendance.studentId, parseInt(id)), eq(attendance.tenantId, tenantId)));

      // Delete the student
      await db.delete(students).where(and(eq(students.id, parseInt(id)), eq(students.tenantId, tenantId)));

      res.json({ success: true });"""

delete_new = """      const { classId } = req.query;
      if (classId) {
         // Remove enrollment
         await db.delete(classEnrollments).where(and(eq(classEnrollments.studentId, parseInt(id)), eq(classEnrollments.classId, parseInt(classId as string))));
         // Also delete attendance for this class
         await db.delete(attendance).where(and(eq(attendance.studentId, parseInt(id)), eq(attendance.classId, parseInt(classId as string))));
      } else {
         // Delete everything if no classId provided
         await db.delete(attendance).where(and(eq(attendance.studentId, parseInt(id)), eq(attendance.tenantId, tenantId)));
         await db.delete(classEnrollments).where(and(eq(classEnrollments.studentId, parseInt(id)), eq(classEnrollments.tenantId, tenantId)));
         await db.delete(students).where(and(eq(students.id, parseInt(id)), eq(students.tenantId, tenantId)));
      }

      res.json({ success: true });"""
code = code.replace(delete_old, delete_new)

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(code)
