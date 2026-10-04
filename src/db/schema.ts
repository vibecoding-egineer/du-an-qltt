import { relations, sql } from 'drizzle-orm';
import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  boolean,
  mysqlEnum,
  index,
  uniqueIndex,
  customType,
  time,
  date,
} from 'drizzle-orm/mysql-core';

/*
 * ============================================================================
 * GHI CHÚ CHUNG VỀ BẢN MYSQL/MARIADB (đọc trước khi sửa file này)
 * ============================================================================
 *
 * 1. KHÓA CHÍNH dùng `int().autoincrement()` CHỨ KHÔNG dùng `serial()`.
 *    Trong Drizzle, `serial()` của MySQL ánh xạ thành BIGINT UNSIGNED, trong khi mọi
 *    cột khóa ngoại ở đây là INT có dấu -> kiểu không khớp, MySQL sẽ TỪ CHỐI tạo khóa ngoại.
 *
 * 2. THỜI GIAN dùng `datetime` CHỨ KHÔNG dùng `timestamp`.
 *    Kiểu TIMESTAMP của MySQL chỉ chứa được từ 1970 đến 2038. Cột `dob` (ngày sinh)
 *    gặp học viên sinh trước 1970 sẽ hỏng. DATETIME chứa từ năm 1000 đến 9999.
 *
 * 3. CỘT ĐƯỢC ĐÁNH INDEX phải là `varchar` có độ dài, không được là `text`.
 *    MySQL không index được kiểu TEXT nếu không khai độ dài tiền tố.
 *    Độ dài được giữ vừa đủ để index gọn: với utf8mb4 mỗi ký tự chiếm 4 byte,
 *    trong khi InnoDB giới hạn khóa 3072 byte.
 *
 * 4. PARTIAL UNIQUE INDEX (`UNIQUE ... WHERE is_deleted = false` của PostgreSQL)
 *    được thay bằng CỘT SINH TỰ ĐỘNG (generated column) - xem chi tiết tại bảng `students`.
 *
 * 5. KIỂU MẢNG không tồn tại trong MySQL -> dùng JSON qua kiểu tuỳ chỉnh bên dưới.
 * ============================================================================
 */

/**
 * Kiểu mảng lưu dưới dạng JSON.
 *
 * VÌ SAO PHẢI TỰ ĐỊNH NGHĨA thay vì dùng `json()` có sẵn: MariaDB triển khai kiểu JSON
 * chỉ như một bí danh của LONGTEXT (khác MySQL 8 có kiểu JSON gốc), nên driver trả về
 * CHUỖI VĂN BẢN chứ không phải mảng đã phân giải. Nếu để mặc định, đoạn code như
 * `permissions.includes('/promotions')` sẽ chạy trên chuỗi và cho kết quả SAI một cách
 * âm thầm (ví dụ quyền '/promo' sẽ khớp nhầm với '/promotions' do so khớp chuỗi con).
 * Kiểu dưới đây luôn phân giải tường minh và xử lý được cả hai trường hợp.
 */
const jsonArray = <TItem>() =>
  customType<{ data: TItem[]; driverData: string }>({
    dataType() {
      return 'json';
    },
    toDriver(value: TItem[]): string {
      return JSON.stringify(value ?? []);
    },
    fromDriver(value: unknown): TItem[] {
      if (Array.isArray(value)) return value as TItem[];
      if (typeof value === 'string') {
        try {
          const parsed: unknown = JSON.parse(value);
          return Array.isArray(parsed) ? (parsed as TItem[]) : [];
        } catch {
          return [];
        }
      }
      return [];
    },
  });

const stringArray = jsonArray<string>();
const numberArray = jsonArray<number>();

export const settings = mysqlTable('settings', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull().unique(),
  centerName: varchar('center_name', { length: 255 }).notNull().default('Schooling'),
  logoUrl: text('logo_url'),
  updatedAt: datetime('updated_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const branches = mysqlTable('branches', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull().default('default-tenant'),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  address: text('address'),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

// Define the 'users' table (required for Firebase Auth)
export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull().default('default-tenant'),
  uid: varchar('uid', { length: 128 }).notNull().unique(), // Firebase Auth UID
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  employeeCode: varchar('employee_code', { length: 64 }),
  phone: varchar('phone', { length: 32 }),
  role: varchar('role', { length: 32 }).default('staff'), // admin, teacher, staff, manager
  // KHÔNG đặt .default([]): MySQL/MariaDB không cho đặt DEFAULT trên cột JSON/TEXT theo
  // cách tương thích. An toàn vì code tạo user luôn truyền `permissions || []`, còn
  // rbac.ts đọc bằng `?.includes(...) ?? false` nên giá trị NULL vẫn xử lý đúng.
  permissions: stringArray('permissions'), // Array of allowed feature keys
  branchId: int('branch_id').references(() => branches.id),
  inviteCode: varchar('invite_code', { length: 32 }).unique(),
  // ID định danh FaceID bên Hanet, dùng để khớp lượt quét mặt khi chấm công.
  // Nhân viên đăng ký trong app Hanet với phân loại "Nhân viên" (personType = 0),
  // khác với học viên dùng phân loại "Khách hàng" (personType = 1).
  //
  // Khác bảng students: ở đây dùng unique index thường chứ không cần cột sinh tự động,
  // vì bảng users không có xóa mềm. Cột cho phép NULL, mà unique index không coi các NULL
  // là trùng nhau, nên nhiều nhân viên chưa liên kết khuôn mặt vẫn cùng tồn tại được.
  hanetPersonId: varchar('hanet_person_id', { length: 128 }).unique(),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
});

export const classes = mysqlTable('classes', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull().default('default-tenant'),
  branchId: int('branch_id').references(() => branches.id),
  teacherId: int('teacher_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  program: varchar('program', { length: 255 }),
  tuition: int('tuition'),
  feeMethod: varchar('fee_method', { length: 32 }).default('per_session'), // 'per_session' | 'per_course'
  sessionsPerMonth: int('sessions_per_month'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('classes_tenant_id_idx').on(table.tenantId),
  index('classes_branch_id_idx').on(table.branchId),
  index('classes_teacher_id_idx').on(table.teacherId),
]);

export const students = mysqlTable('students', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull().default('default-tenant'),
  name: varchar('name', { length: 255 }).notNull(),
  studentCode: varchar('student_code', { length: 64 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  dob: datetime('dob', { mode: 'date' }), // Ngày sinh - DATETIME để chứa được năm trước 1970
  gender: varchar('gender', { length: 16 }), // Giới tính
  parentName: varchar('parent_name', { length: 255 }), // Họ tên phụ huynh
  parentPhone: varchar('parent_phone', { length: 32 }), // Điện thoại phụ huynh
  address: text('address'), // Địa chỉ
  note: text('note'), // Ghi chú
  faceDescriptor: text('face_descriptor'), // JSON stringified array of floats
  hanetPersonId: varchar('hanet_person_id', { length: 128 }), // ID định danh FaceID bên Hanet
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),

  // --- Cột sinh tự động, thay cho partial unique index của PostgreSQL ---
  // Cách hoạt động: học viên CÒN hoạt động -> cột chứa giá trị thật -> ràng buộc duy nhất
  // có hiệu lực. Học viên ĐÃ xóa mềm -> cột thành NULL -> mà unique index trong SQL không
  // coi các giá trị NULL là trùng nhau, nên bao nhiêu bản ghi đã xóa cũng được.
  // Kết quả: đúng bằng partial index của PostgreSQL, và mã của học viên đã nghỉ vẫn cấp lại được.
  // Dùng chế độ 'stored' (không phải 'virtual') để chắc chắn đánh được unique index trên MariaDB.
  // Ứng dụng KHÔNG BAO GIỜ ghi vào 2 cột này - MariaDB tự tính từ các cột gốc.
  activeStudentCode: varchar('active_student_code', { length: 64 })
    .generatedAlwaysAs(sql`(CASE WHEN is_deleted = 0 THEN student_code ELSE NULL END)`, { mode: 'stored' }),
  activeHanetPersonId: varchar('active_hanet_person_id', { length: 128 })
    .generatedAlwaysAs(sql`(CASE WHEN is_deleted = 0 THEN hanet_person_id ELSE NULL END)`, { mode: 'stored' }),
}, (table) => [
  index('students_tenant_id_idx').on(table.tenantId),
  // Mã học viên duy nhất trong phạm vi 1 tenant, chỉ tính học viên chưa bị xóa mềm.
  uniqueIndex('students_tenant_code_active_unique').on(table.tenantId, table.activeStudentCode),
  // 1 FaceID bên Hanet chỉ gắn với đúng 1 học viên đang hoạt động tại 1 thời điểm.
  uniqueIndex('students_hanet_person_id_active_unique').on(table.activeHanetPersonId),
]);

export const classEnrollments = mysqlTable('class_enrollments', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull().default('default-tenant'),
  studentId: int('student_id').references(() => students.id).notNull(),
  classId: int('class_id').references(() => classes.id).notNull(),
  tuitionStatus: varchar('tuition_status', { length: 32 }).default('Chưa đóng'),
  tuitionOwed: int('tuition_owed').default(0),
  tuitionFee: int('tuition_fee'),
  entryLevel: varchar('entry_level', { length: 64 }),
  enrollmentDate: datetime('enrollment_date', { mode: 'date' }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),

  // Cùng cơ chế cột sinh tự động như bảng students (xem giải thích ở trên).
  activeStudentId: int('active_student_id')
    .generatedAlwaysAs(sql`(CASE WHEN is_deleted = 0 THEN student_id ELSE NULL END)`, { mode: 'stored' }),
  activeClassId: int('active_class_id')
    .generatedAlwaysAs(sql`(CASE WHEN is_deleted = 0 THEN class_id ELSE NULL END)`, { mode: 'stored' }),
}, (table) => [
  index('class_enrollments_tenant_id_idx').on(table.tenantId),
  index('class_enrollments_student_id_idx').on(table.studentId),
  index('class_enrollments_class_id_idx').on(table.classId),
  // Một học viên chỉ có 1 lượt ghi danh "đang hoạt động" cho 1 lớp tại 1 thời điểm.
  uniqueIndex('class_enrollments_student_class_active_unique')
    .on(table.activeStudentId, table.activeClassId),
]);

export const attendance = mysqlTable('attendance', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull().default('default-tenant'),
  studentId: int('student_id')
    .references(() => students.id)
    .notNull(),
  classId: int('class_id')
    .references(() => classes.id)
    .notNull(),
  date: datetime('date', { mode: 'date' }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('present'), // present, absent_with_permission, absent_without_permission
  homeworkCompleted: int('homework_completed').default(0), // 0: No, 1: Yes
  note: text('note'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('attendance_tenant_id_idx').on(table.tenantId),
  index('attendance_student_id_idx').on(table.studentId),
  index('attendance_class_id_idx').on(table.classId),
]);

export const transactions = mysqlTable('transactions', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull().default('default-tenant'),
  branchId: int('branch_id').references(() => branches.id),
  type: varchar('type', { length: 16 }).notNull(), // 'income' | 'expense'
  category: varchar('category', { length: 32 }).notNull(), // 'tuition', 'salary', 'infrastructure', 'other'
  amount: int('amount').notNull(),
  date: datetime('date', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  note: text('note'),
  studentId: int('student_id').references(() => students.id), // Nullable
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
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

export const promotions = mysqlTable('promotions', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  discountType: varchar('discount_type', { length: 16 }).notNull(), // 'percentage' | 'fixed'
  discountValue: int('discount_value').notNull(),
  branchIds: numberArray('branch_ids').notNull(),
  startDate: datetime('start_date', { mode: 'date' }),
  endDate: datetime('end_date', { mode: 'date' }),
  isActive: boolean('is_active').default(true).notNull(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('promotions_tenant_id_idx').on(table.tenantId),
]);

// ===== Giấy phép sử dụng (SaaS license) =====
// Mỗi trung tâm muốn khởi tạo phải có 1 mã kích hoạt do chủ hệ thống cấp.
// Mã dùng 1 lần (usedAt + tenantId được điền khi kích hoạt) và có thời hạn (expiresAt).
// Sau khi hết hạn, các API sẽ bị chặn cho tới khi được gia hạn (cập nhật expiresAt).
export const licenses = mysqlTable('licenses', {
  id: int('id').autoincrement().primaryKey(),
  code: varchar('code', { length: 64 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }), // ghi chú tên khách hàng/trung tâm
  note: text('note'),
  expiresAt: datetime('expires_at', { mode: 'date' }).notNull(), // hết hạn -> khóa trung tâm
  usedAt: datetime('used_at', { mode: 'date' }),                 // null = chưa ai dùng
  tenantId: varchar('tenant_id', { length: 128 }),               // tenant đã kích hoạt bằng mã này
  isRevoked: boolean('is_revoked').notNull().default(false),     // thu hồi thủ công
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('licenses_code_unique').on(table.code),
  // 1 tenant chỉ gắn với 1 giấy phép -> gia hạn nghĩa là cập nhật expiresAt của chính dòng này.
  // Cột cho phép NULL, mà unique index không coi các NULL là trùng nhau, nên vẫn tồn tại
  // được nhiều mã CHƯA sử dụng cùng lúc - đúng như hành vi ở bản PostgreSQL.
  uniqueIndex('licenses_tenant_id_unique').on(table.tenantId),
]);

// ===== Tích hợp camera Hanet AI =====

// Danh sách lý do một check-in bị đưa vào hàng chờ. Xuất ra để code khác dùng lại được
// thay vì gõ tay chuỗi (bản PostgreSQL trước đây là một kiểu enum riêng của database).
export const HANET_PENDING_CHECKIN_REASONS = [
  'unlinked_face',           // personID chưa được gán cho học viên nào trong hệ thống
  'no_active_class',         // đã tìm ra học viên, nhưng học viên không còn ghi danh lớp nào
  'no_open_session',         // có lớp nhưng không lớp nào đang mở phiên điểm danh
  'multiple_open_sessions',  // nhiều hơn 1 lớp của học viên cùng đang mở phiên
] as const;

export type HanetPendingCheckinReason = (typeof HANET_PENDING_CHECKIN_REASONS)[number];

// Giáo viên/lễ tân bấm "mở" trước khi buổi học bắt đầu, để hệ thống biết check-in
// từ camera Hanet trong khoảng thời gian này thuộc về lớp nào. Hết hiệu lực sau một
// khoảng thời gian cố định (xử lý ở tầng ứng dụng khi truy vấn, xem server.ts), hoặc
// đóng sớm bằng cách set closedAt.
export const attendanceSessions = mysqlTable('attendance_sessions', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull(),
  classId: int('class_id').references(() => classes.id).notNull(),
  openedBy: int('opened_by').references(() => users.id).notNull(),
  // Giáo viên THỰC TẾ dạy buổi này. Tách khỏi openedBy vì người bấm mở phiên có thể là
  // lễ tân chứ không phải người đứng lớp, và vì có trường hợp dạy thay. Mặc định giao diện
  // điền sẵn giáo viên phụ trách lớp, người dùng đổi được.
  taughtBy: int('taught_by').references(() => users.id),
  openedAt: datetime('opened_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  closedAt: datetime('closed_at', { mode: 'date' }), // null = chưa chủ động đóng
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('attendance_sessions_tenant_id_idx').on(table.tenantId),
  index('attendance_sessions_class_id_idx').on(table.classId),
]);

// Hàng đợi các check-in từ camera Hanet mà hệ thống KHÔNG tự tin gán được vào đúng 1
// lớp cụ thể (lý do cụ thể xem HANET_PENDING_CHECKIN_REASONS ở trên). Nhân viên xử lý
// thủ công qua UI, chọn lớp rồi hệ thống mới thực sự tạo bản ghi trong bảng `attendance`.
export const hanetPendingCheckins = mysqlTable('hanet_pending_checkins', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull(),
  hanetRecordId: varchar('hanet_record_id', { length: 128 }).notNull(), // chống xử lý trùng nếu webhook gọi lại
  hanetPersonId: varchar('hanet_person_id', { length: 128 }).notNull(),
  personName: varchar('person_name', { length: 255 }), // tên Hanet gửi kèm
  studentId: int('student_id').references(() => students.id), // null nếu chưa liên kết được học viên
  candidateClassIds: numberArray('candidate_class_ids'), // các lớp khả dĩ, để UI cho chọn nhanh
  checkinTime: datetime('checkin_time', { mode: 'date' }).notNull(),
  imageUrl: text('image_url'), // detected_image_url Hanet gửi kèm, để đối chiếu bằng mắt
  reason: mysqlEnum('reason', HANET_PENDING_CHECKIN_REASONS).notNull(),
  resolvedAt: datetime('resolved_at', { mode: 'date' }),
  resolvedClassId: int('resolved_class_id').references(() => classes.id),
  resolvedBy: int('resolved_by').references(() => users.id),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
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

// ===== Ca làm việc, thời khóa biểu và chấm công =====

// Ca làm việc / ca học: chỉ là khung giờ có tên, dùng lại cho cả thời khóa biểu lớp
// lẫn phân ca nhân viên. Ví dụ "Ca sáng 07:30-11:30", "Ca 1 07:30-09:30".
export const shifts = mysqlTable('shifts', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  // Kiểu TIME của MySQL, driver trả về chuỗi dạng "07:30:00". Không lưu kèm ngày nên
  // không dính chuyện múi giờ - đây chỉ là "giờ trong ngày", không phải một thời điểm.
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  // Đánh dấu ca hành chính (theo cách phân loại trong app camera). Chỉ để phân nhóm khi
  // hiển thị, không ảnh hưởng cách tính công.
  isAdministrative: boolean('is_administrative').notNull().default(false),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('shifts_tenant_id_idx').on(table.tenantId),
]);

// Thời khóa biểu: lớp nào học ca nào vào thứ mấy.
// Một lớp có nhiều dòng - ví dụ Toán 9A: thứ 2 ca sáng, thứ 4 ca sáng, thứ 6 ca chiều.
// Mỗi buổi được phép dùng ca khác nhau.
export const classSchedules = mysqlTable('class_schedules', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull(),
  classId: int('class_id').references(() => classes.id).notNull(),
  shiftId: int('shift_id').references(() => shifts.id).notNull(),
  // Quy ước: 1 = Thứ 2, 2 = Thứ 3, ... 6 = Thứ 7, 7 = Chủ nhật.
  // Dùng quy ước này thay vì kiểu 0 = Chủ nhật của JavaScript, vì người Việt đọc lịch
  // bắt đầu từ thứ 2 - tránh lệch một ngày khi hiển thị.
  dayOfWeek: int('day_of_week').notNull(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),

  // Cột sinh tự động để chống xếp trùng: cùng một lớp không thể có hai dòng lịch giống hệt
  // (cùng thứ, cùng ca) trong số các dòng chưa bị xóa mềm.
  activeScheduleKey: varchar('active_schedule_key', { length: 64 })
    .generatedAlwaysAs(sql`(CASE WHEN is_deleted = 0 THEN CONCAT(class_id, '-', day_of_week, '-', shift_id) ELSE NULL END)`, { mode: 'stored' }),
}, (table) => [
  index('class_schedules_tenant_id_idx').on(table.tenantId),
  index('class_schedules_class_id_idx').on(table.classId),
  index('class_schedules_shift_id_idx').on(table.shiftId),
  index('class_schedules_day_idx').on(table.dayOfWeek),
  uniqueIndex('class_schedules_active_unique').on(table.activeScheduleKey),
]);

// Phân ca cho nhân viên theo TỪNG NGÀY cụ thể (không phải theo thứ cố định),
// vì ca của nhân viên có thể thay đổi theo ngày. Cho phép xếp lịch trước cả tháng.
// Một nhân viên có thể được phân nhiều ca trong cùng một ngày (ví dụ sáng và tối).
export const staffShifts = mysqlTable('staff_shifts', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull(),
  userId: int('user_id').references(() => users.id).notNull(),
  shiftId: int('shift_id').references(() => shifts.id).notNull(),
  // Ngày làm việc. Dùng kiểu DATE (không kèm giờ) để so sánh theo ngày cho gọn.
  workDate: date('work_date', { mode: 'string' }).notNull(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),

  // Chống phân trùng: cùng nhân viên, cùng ngày, cùng ca thì chỉ một dòng.
  activeAssignmentKey: varchar('active_assignment_key', { length: 64 })
    .generatedAlwaysAs(sql`(CASE WHEN is_deleted = 0 THEN CONCAT(user_id, '-', work_date, '-', shift_id) ELSE NULL END)`, { mode: 'stored' }),
}, (table) => [
  index('staff_shifts_tenant_id_idx').on(table.tenantId),
  index('staff_shifts_user_id_idx').on(table.userId),
  index('staff_shifts_shift_id_idx').on(table.shiftId),
  index('staff_shifts_work_date_idx').on(table.workDate),
  uniqueIndex('staff_shifts_active_unique').on(table.activeAssignmentKey),
]);

export const staffAttendanceSource = ['camera', 'manual'] as const;
export type StaffAttendanceSource = (typeof staffAttendanceSource)[number];

// Chấm công nhân viên: mỗi nhân viên mỗi ngày một dòng.
// Lần quét mặt đầu tiên trong ngày ghi vào checkInTime, lần cuối cùng ghi vào checkOutTime,
// nên nhân viên ra vào nhiều lần cũng không sinh thêm dòng.
export const staffAttendance = mysqlTable('staff_attendance', {
  id: int('id').autoincrement().primaryKey(),
  tenantId: varchar('tenant_id', { length: 128 }).notNull(),
  userId: int('user_id').references(() => users.id).notNull(),
  workDate: date('work_date', { mode: 'string' }).notNull(),
  checkInTime: datetime('check_in_time', { mode: 'date' }),
  checkOutTime: datetime('check_out_time', { mode: 'date' }),

  // Ca được dùng làm mốc đối chiếu khi tính đi muộn / về sớm.
  // Lưu lại ID ca thay vì chỉ tra lúc xem báo cáo, để nếu sau này lịch phân ca bị sửa thì
  // bản ghi công cũ vẫn giữ nguyên căn cứ đã dùng - đúng nguyên tắc của dữ liệu chấm công.
  shiftId: int('shift_id').references(() => shifts.id),
  // Số phút đi muộn / về sớm, tính tại thời điểm ghi nhận so với ca ở trên.
  // Lưu sẵn vì cùng lý do: đổi lịch phân ca về sau không được làm thay đổi công đã chốt.
  lateMinutes: int('late_minutes').notNull().default(0),
  earlyLeaveMinutes: int('early_leave_minutes').notNull().default(0),

  source: mysqlEnum('source', staffAttendanceSource).notNull().default('camera'),
  note: text('note'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),

  // Mỗi nhân viên mỗi ngày chỉ một bản ghi công đang hiệu lực.
  activeAttendanceKey: varchar('active_attendance_key', { length: 64 })
  .generatedAlwaysAs(sql`(CASE WHEN is_deleted = 0 THEN CONCAT(user_id, '-', work_date, '-', COALESCE(shift_id, 0)) ELSE NULL END)`, { mode: 'stored' }),
}, (table) => [
  index('staff_attendance_tenant_id_idx').on(table.tenantId),
  index('staff_attendance_user_id_idx').on(table.userId),
  index('staff_attendance_work_date_idx').on(table.workDate),
  uniqueIndex('staff_attendance_active_unique').on(table.activeAttendanceKey),
]);

export const shiftsRelations = relations(shifts, ({ many }) => ({
  classSchedules: many(classSchedules),
  staffShifts: many(staffShifts),
}));

export const classSchedulesRelations = relations(classSchedules, ({ one }) => ({
  class: one(classes, {
    fields: [classSchedules.classId],
    references: [classes.id],
  }),
  shift: one(shifts, {
    fields: [classSchedules.shiftId],
    references: [shifts.id],
  }),
}));

export const staffShiftsRelations = relations(staffShifts, ({ one }) => ({
  user: one(users, {
    fields: [staffShifts.userId],
    references: [users.id],
  }),
  shift: one(shifts, {
    fields: [staffShifts.shiftId],
    references: [shifts.id],
  }),
}));

export const staffAttendanceRelations = relations(staffAttendance, ({ one }) => ({
  user: one(users, {
    fields: [staffAttendance.userId],
    references: [users.id],
  }),
  shift: one(shifts, {
    fields: [staffAttendance.shiftId],
    references: [shifts.id],
  }),
}));
