import re

with open('src/db/schema.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Add class_enrollments table
enrollments_table = """
export const classEnrollments = pgTable('class_enrollments', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  studentId: integer('student_id').references(() => students.id).notNull(),
  classId: integer('class_id').references(() => classes.id).notNull(),
  tuitionStatus: text('tuition_status').default('Chưa đóng'),
  tuitionOwed: integer('tuition_owed').default(0),
  tuitionFee: integer('tuition_fee'),
  entryLevel: text('entry_level'),
  enrollmentDate: timestamp('enrollment_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

"""

# Insert it before attendance
code = code.replace("export const attendance = pgTable('attendance'", enrollments_table + "export const attendance = pgTable('attendance'")

# Update relations
classes_rel_old = """export const classesRelations = relations(classes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [classes.branchId],
    references: [branches.id],
  }),
  students: many(students),
}));"""

classes_rel_new = """export const classesRelations = relations(classes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [classes.branchId],
    references: [branches.id],
  }),
  students: many(students),
  classEnrollments: many(classEnrollments),
}));"""
code = code.replace(classes_rel_old, classes_rel_new)

students_rel_old = """export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  transactions: many(transactions),
}));"""

students_rel_new = """export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  transactions: many(transactions),
  classEnrollments: many(classEnrollments),
}));

export const classEnrollmentsRelations = relations(classEnrollments, ({ one }) => ({
  student: one(students, {
    fields: [classEnrollments.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [classEnrollments.classId],
    references: [classes.id],
  }),
}));"""
code = code.replace(students_rel_old, students_rel_new)

with open('src/db/schema.ts', 'w', encoding='utf-8') as f:
    f.write(code)
