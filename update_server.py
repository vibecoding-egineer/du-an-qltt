import re

with open('server.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Make sure class_enrollments is imported
if "classEnrollments" not in code:
    code = code.replace("transactions, promotions } from './src/db/schema';", "transactions, promotions, classEnrollments } from './src/db/schema';")
if "class_enrollments" in code and "classEnrollments" not in code:
    pass

# Update GET /api/students
get_students_old = """      let query = db.select().from(students).where(eq(students.tenantId, tenantId)) as any;
      const conditions = [eq(students.tenantId, tenantId)];
      if (classId) {
        conditions.push(eq(students.classId, parseInt(classId as string)));
      }
      if (allowedClassIds) {
        conditions.push(inArray(students.classId, allowedClassIds));
      }
      query = db.select().from(students).where(and(...conditions)) as any;

      const result = await query;"""

get_students_new = """      const conditions = [eq(classEnrollments.tenantId, tenantId)];
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
      }));"""
code = code.replace(get_students_old, get_students_new)

# In attendance count loop, replace result with the new format (it's already result.map later)
# Wait, let's check how attendance count is done
attendance_loop_old = """      const studentsWithAttendance = await Promise.all(result.map(async (student: any) => {"""
attendance_loop_new = """      const studentsWithAttendance = await Promise.all(result.map(async (student: any) => {"""
# No change needed there if student has .id

# Update POST /api/students
post_student_old_start = """      const result = await db.insert(students).values({
        tenantId,
        name,
        studentCode: studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        phone,
        classId: parseInt(classId),
        tuitionStatus: (req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager') ? (tuitionStatus || 'Chưa đóng') : 'Chưa đóng',
        tuitionOwed: (tuitionStatus === 'Còn thiếu' && tuitionOwed) ? parseInt(tuitionOwed) : 0,
        dob: dob ? new Date(dob) : null,
        gender: gender || null,
        entryLevel: entryLevel || null,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null,
        tuitionFee: tuitionFee ? parseInt(tuitionFee) : null,
        parentName: parentName || null,
        parentPhone: parentPhone || null,
        address: address || null,
        note: note || null
      }).returning();
      res.json(result[0]);"""

post_student_new = """      // Try to find if student code exists
      let student = null;
      if (studentCode) {
         const existing = await db.select().from(students).where(and(eq(students.tenantId, tenantId), eq(students.studentCode, studentCode)));
         if (existing.length > 0) student = existing[0];
      }
      
      if (!student) {
        const insertRes = await db.insert(students).values({
          tenantId,
          name,
          studentCode: studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          phone,
          dob: dob ? new Date(dob) : null,
          gender: gender || null,
          parentName: parentName || null,
          parentPhone: parentPhone || null,
          address: address || null,
          note: note || null
        }).returning();
        student = insertRes[0];
      }

      const enrollmentRes = await db.insert(classEnrollments).values({
        tenantId,
        studentId: student.id,
        classId: parseInt(classId),
        tuitionStatus: (req.dbUser?.role === 'admin' || req.dbUser?.role === 'manager') ? (tuitionStatus || 'Chưa đóng') : 'Chưa đóng',
        tuitionOwed: (tuitionStatus === 'Còn thiếu' && tuitionOwed) ? parseInt(tuitionOwed) : 0,
        tuitionFee: tuitionFee ? parseInt(tuitionFee) : null,
        entryLevel: entryLevel || null,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null,
      }).returning();

      res.json({ ...student, classId: enrollmentRes[0].classId, tuitionStatus: enrollmentRes[0].tuitionStatus, tuitionOwed: enrollmentRes[0].tuitionOwed });"""
code = code.replace(post_student_old_start, post_student_new)

# Update POST /api/students/bulk
bulk_old_start = """      const valuesToInsert = studentsData.map((s: any) => ({
        tenantId,
        classId: parseInt(classId),
        name: s.name,
        studentCode: s.studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        phone: s.phone || null,
        dob: parseDate(s.dob),
        gender: s.gender || null,
        entryLevel: s.entryLevel || null,
        enrollmentDate: parseDate(s.enrollmentDate),
        tuitionFee: parseMoney(s.tuitionFee),
        parentName: s.parentName || null,
        parentPhone: s.parentPhone || null,
        address: s.address || null,
        note: s.note || null,
        tuitionStatus: 'Chưa đóng',
        tuitionOwed: 0
      }));

      const result = await db.insert(students).values(valuesToInsert).returning();
      res.json(result);"""

bulk_new = """      
      const insertedStudents = [];
      for (const s of studentsData) {
        const scode = s.studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        let student = null;
        if (s.studentCode) {
           const existing = await db.select().from(students).where(and(eq(students.tenantId, tenantId), eq(students.studentCode, scode)));
           if (existing.length > 0) student = existing[0];
        }
        
        if (!student) {
           const sInsert = await db.insert(students).values({
              tenantId,
              name: s.name,
              studentCode: scode,
              phone: s.phone || null,
              dob: parseDate(s.dob),
              gender: s.gender || null,
              parentName: s.parentName || null,
              parentPhone: s.parentPhone || null,
              address: s.address || null,
              note: s.note || null
           }).returning();
           student = sInsert[0];
        }
        insertedStudents.push(student);
        
        // Check if enrollment already exists
        const existingEnrollment = await db.select().from(classEnrollments).where(and(eq(classEnrollments.studentId, student.id), eq(classEnrollments.classId, parseInt(classId))));
        
        if (existingEnrollment.length === 0) {
           await db.insert(classEnrollments).values({
              tenantId,
              studentId: student.id,
              classId: parseInt(classId),
              tuitionStatus: 'Chưa đóng',
              tuitionOwed: 0,
              tuitionFee: parseMoney(s.tuitionFee),
              entryLevel: s.entryLevel || null,
              enrollmentDate: parseDate(s.enrollmentDate)
           });
        }
      }
      res.json(insertedStudents);"""
code = code.replace(bulk_old_start, bulk_new)

# PUT /api/students/:id
# For this one, the frontend form updates student fields AND enrollment fields at the same time.
# But it only passes `classId` as part of the student object? 
# Let's check how the PUT route is written.
with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(code)
