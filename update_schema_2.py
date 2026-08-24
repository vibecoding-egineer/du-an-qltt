import re

with open('src/db/schema.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove columns from students
students_old = """export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  name: text('name').notNull(),
  studentCode: text('student_code').notNull(),
  phone: text('phone'),
  classId: integer('class_id')
    .references(() => classes.id)
    .notNull(),
  tuitionStatus: text('tuition_status').default('Chưa đóng'),
  tuitionOwed: integer('tuition_owed').default(0),
  tuitionFee: integer('tuition_fee'), // Số tiền phải nộp (nếu khác mặc định của lớp)
  dob: timestamp('dob'), // Ngày sinh
  gender: text('gender'), // Giới tính
  entryLevel: text('entry_level'), // Trình độ đầu vào
  enrollmentDate: timestamp('enrollment_date'), // Ngày nhập học
  parentName: text('parent_name'), // Họ tên phụ huynh
  parentPhone: text('parent_phone'), // Điện thoại phụ huynh
  address: text('address'), // Địa chỉ
  note: text('note'), // Ghi chú
  faceDescriptor: text('face_descriptor'), // JSON stringified array of floats
  createdAt: timestamp('created_at').defaultNow(),
});"""

students_new = """export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  name: text('name').notNull(),
  studentCode: text('student_code').notNull(),
  phone: text('phone'),
  dob: timestamp('dob'), // Ngày sinh
  gender: text('gender'), // Giới tính
  parentName: text('parent_name'), // Họ tên phụ huynh
  parentPhone: text('parent_phone'), // Điện thoại phụ huynh
  address: text('address'), // Địa chỉ
  note: text('note'), // Ghi chú
  faceDescriptor: text('face_descriptor'), // JSON stringified array of floats
  createdAt: timestamp('created_at').defaultNow(),
});"""
code = code.replace(students_old, students_new)

# Clean up relations
classes_rel_old = """export const classesRelations = relations(classes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [classes.branchId],
    references: [branches.id],
  }),
  students: many(students),
  classEnrollments: many(classEnrollments),
}));"""

classes_rel_new = """export const classesRelations = relations(classes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [classes.branchId],
    references: [branches.id],
  }),
  classEnrollments: many(classEnrollments),
}));"""
code = code.replace(classes_rel_old, classes_rel_new)

students_rel_old = """export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  transactions: many(transactions),
  classEnrollments: many(classEnrollments),
}));"""

students_rel_new = """export const studentsRelations = relations(students, ({ many }) => ({
  transactions: many(transactions),
  classEnrollments: many(classEnrollments),
}));"""
code = code.replace(students_rel_old, students_rel_new)

with open('src/db/schema.ts', 'w', encoding='utf-8') as f:
    f.write(code)
