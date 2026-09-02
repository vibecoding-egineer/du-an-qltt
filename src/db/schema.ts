import { relations, sql } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, json, boolean, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().unique(),
  centerName: text('center_name').notNull().default('Eduspace'),
  logoUrl: text('logo_url'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  name: text('name').notNull(),
  code: text('code').notNull(),
  phone: text('phone'),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'users' table (required for Firebase Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  employeeCode: text('employee_code'),
  phone: text('phone'),
  role: text('role').default('staff'), // E.g., admin, teacher, staff, manager
  permissions: text('permissions').array().default([]), // Array of allowed feature keys
  branchId: integer('branch_id').references(() => branches.id),
  inviteCode: text('invite_code').unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  branchId: integer('branch_id').references(() => branches.id),
  teacherId: integer('teacher_id').references(() => users.id),
  name: text('name').notNull(),
  program: text('program'),
  tuition: integer('tuition'),
  feeMethod: text('fee_method').default('per_session'), // 'per_session' | 'per_course'
  sessionsPerMonth: integer('sessions_per_month'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('classes_tenant_id_idx').on(table.tenantId),
  index('classes_branch_id_idx').on(table.branchId),
  index('classes_teacher_id_idx').on(table.teacherId),
]);

export const students = pgTable('students', {
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
  hanetPersonId: text('hanet_person_id'), // ID định danh FaceID bên hệ thống Hanet, dùng để khớp check-in từ camera
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('students_tenant_id_idx').on(table.tenantId),
  // Chỉ bắt buộc studentCode duy nhất trong số các bản ghi CHƯA bị xóa (soft delete).
  // Nhờ vậy học viên cũ bị xóa mềm không chặn việc cấp lại mã cho học viên mới.
  uniqueIndex('students_tenant_code_active_unique')
    .on(table.tenantId, table.studentCode)
    .where(sql`${table.isDeleted} = false`),
  // 1 FaceID bên Hanet chỉ được gắn với đúng 1 học viên đang hoạt động tại 1 thời điểm.
  // Cho phép NULL (học viên chưa liên kết Hanet), và cho phép gắn lại cho học viên khác
  // nếu học viên cũ từng giữ FaceID đó đã bị xóa mềm.
  uniqueIndex('students_hanet_person_id_active_unique')
    .on(table.hanetPersonId)
    .where(sql`${table.isDeleted} = false AND ${table.hanetPersonId} IS NOT NULL`),
]);


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
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('class_enrollments_tenant_id_idx').on(table.tenantId),
  index('class_enrollments_student_id_idx').on(table.studentId),
  index('class_enrollments_class_id_idx').on(table.classId),
  // Một học viên chỉ có 1 lượt ghi danh "đang hoạt động" cho 1 lớp tại 1 thời điểm.
  uniqueIndex('class_enrollments_student_class_active_unique')
    .on(table.studentId, table.classId)
    .where(sql`${table.isDeleted} = false`),
]);

export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  studentId: integer('student_id')
    .references(() => students.id)
    .notNull(),
  classId: integer('class_id')
    .references(() => classes.id)
    .notNull(),
  date: timestamp('date').notNull(),
  status: text('status').notNull().default('present'), // present, absent_with_permission, absent_without_permission
  homeworkCompleted: integer('homework_completed').default(0), // 0: No, 1: Yes
  note: text('note'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('attendance_tenant_id_idx').on(table.tenantId),
  index('attendance_student_id_idx').on(table.studentId),
  index('attendance_class_id_idx').on(table.classId),
]);

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().default('default-tenant'),
  branchId: integer('branch_id').references(() => branches.id),
  type: text('type').notNull(), // 'income' | 'expense'
  category: text('category').notNull(), // 'tuition', 'salary', 'infrastructure', 'other'
  amount: integer('amount').notNull(),
  date: timestamp('date').notNull().defaultNow(),
  note: text('note'),
  studentId: integer('student_id').references(() => students.id), // Nullable
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('transactions_tenant_id_idx').on(table.tenantId),
  index('transactions_branch_id_idx').on(table.branchId),
  index('transactions_student_id_idx').on(table.studentId),
]);

// Relationships
export const branchesRelations = relations(branches, ({ many }) => ({
  classes: many(classes),
  transactions: many(transactions),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [classes.branchId],
    references: [branches.id],
  }),
  classEnrollments: many(classEnrollments),
}));

export const studentsRelations = relations(students, ({ many }) => ({
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
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  branch: one(branches, {
    fields: [transactions.branchId],
    references: [branches.id],
  }),
  student: one(students, {
    fields: [transactions.studentId],
    references: [students.id],
  }),
}));

export const promotions = pgTable('promotions', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  discountType: text('discount_type').notNull(), // 'percentage' | 'fixed'
  discountValue: integer('discount_value').notNull(),
  branchIds: integer('branch_ids').array().notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  isActive: boolean('is_active').default(true).notNull(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('promotions_tenant_id_idx').on(table.tenantId),
]);

// ===== Tích hợp camera Hanet AI =====

export const hanetPendingCheckinReason = pgEnum('hanet_pending_checkin_reason', [
  'unlinked_face',           // personID chưa được gán cho học viên nào trong hệ thống
  'no_active_class',         // đã tìm ra học viên, nhưng học viên không còn ghi danh lớp nào
  'no_open_session',         // có lớp nhưng không lớp nào đang mở phiên điểm danh
  'multiple_open_sessions',  // nhiều hơn 1 lớp của học viên cùng đang mở phiên
]);

// Giáo viên/lễ tân bấm "mở" trước khi buổi học bắt đầu, để hệ thống biết check-in
// từ camera Hanet trong khoảng thời gian này thuộc về lớp nào. Hết hiệu lực sau một
// khoảng thời gian cố định (xử lý ở tầng ứng dụng khi truy vấn, xem server.ts), hoặc
// đóng sớm bằng cách set closedAt.
export const attendanceSessions = pgTable('attendance_sessions', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  classId: integer('class_id').references(() => classes.id).notNull(),
  openedBy: integer('opened_by').references(() => users.id).notNull(),
  openedAt: timestamp('opened_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at'), // null = chưa chủ động đóng (có thể vẫn đã hết hạn theo thời gian)
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('attendance_sessions_tenant_id_idx').on(table.tenantId),
  index('attendance_sessions_class_id_idx').on(table.classId),
]);

// Hàng đợi các check-in từ camera Hanet mà hệ thống KHÔNG tự tin gán được vào đúng 1
// lớp cụ thể (lý do cụ thể xem enum reason ở trên). Nhân viên xử lý thủ công qua UI,
// chọn lớp rồi hệ thống mới thực sự tạo bản ghi trong bảng `attendance`.
export const hanetPendingCheckins = pgTable('hanet_pending_checkins', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  hanetRecordId: text('hanet_record_id').notNull(), // trường "id" Hanet gửi kèm - chống xử lý trùng nếu webhook gọi lại
  hanetPersonId: text('hanet_person_id').notNull(),
  personName: text('person_name'), // tên Hanet gửi kèm, hiển thị tạm khi chưa liên kết được học viên
  studentId: integer('student_id').references(() => students.id), // null nếu chưa liên kết được học viên nào
  candidateClassIds: integer('candidate_class_ids').array(), // các lớp khả dĩ, để UI cho chọn nhanh
  checkinTime: timestamp('checkin_time').notNull(),
  imageUrl: text('image_url'), // detected_image_url Hanet gửi kèm, để nhân viên đối chiếu bằng mắt
  reason: hanetPendingCheckinReason('reason').notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedClassId: integer('resolved_class_id').references(() => classes.id),
  resolvedBy: integer('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('hanet_pending_checkins_tenant_id_idx').on(table.tenantId),
  index('hanet_pending_checkins_student_id_idx').on(table.studentId),
  uniqueIndex('hanet_pending_checkins_record_id_unique').on(table.hanetRecordId),
]);

export const attendanceSessionsRelations = relations(attendanceSessions, ({ one }) => ({
  class: one(classes, {
    fields: [attendanceSessions.classId],
    references: [classes.id],
  }),
  openedByUser: one(users, {
    fields: [attendanceSessions.openedBy],
    references: [users.id],
  }),
}));

export const hanetPendingCheckinsRelations = relations(hanetPendingCheckins, ({ one }) => ({
  student: one(students, {
    fields: [hanetPendingCheckins.studentId],
    references: [students.id],
  }),
  resolvedClass: one(classes, {
    fields: [hanetPendingCheckins.resolvedClassId],
    references: [classes.id],
  }),
}));
