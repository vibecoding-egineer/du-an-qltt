var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/lib/firebase-admin.ts
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");

// firebase-applet-config.json
var firebase_applet_config_default = {
  apiKey: "AIzaSyAEsBw7DExWGsYDdAeOn6AVbyHYJk-hhIA",
  authDomain: "qltt-9e1f8.firebaseapp.com",
  projectId: "qltt-9e1f8",
  storageBucket: "qltt-9e1f8.firebasestorage.app",
  messagingSenderId: "879653948624",
  appId: "1:879653948624:web:089343164741a4713262d5"
};

// src/lib/firebase-admin.ts
if (!(0, import_app.getApps)().length) {
  (0, import_app.initializeApp)({
    projectId: firebase_applet_config_default.projectId
  });
}
var adminAuth = (0, import_auth.getAuth)();

// src/db/index.ts
var import_mysql2 = require("drizzle-orm/mysql2");
var import_promise = __toESM(require("mysql2/promise"), 1);

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  HANET_PENDING_CHECKIN_REASONS: () => HANET_PENDING_CHECKIN_REASONS,
  attendance: () => attendance,
  attendanceSessions: () => attendanceSessions,
  attendanceSessionsRelations: () => attendanceSessionsRelations,
  branches: () => branches,
  branchesRelations: () => branchesRelations,
  classEnrollments: () => classEnrollments,
  classEnrollmentsRelations: () => classEnrollmentsRelations,
  classSchedules: () => classSchedules,
  classSchedulesRelations: () => classSchedulesRelations,
  classes: () => classes,
  classesRelations: () => classesRelations,
  hanetPendingCheckins: () => hanetPendingCheckins,
  hanetPendingCheckinsRelations: () => hanetPendingCheckinsRelations,
  licenses: () => licenses,
  promotions: () => promotions,
  settings: () => settings,
  shifts: () => shifts,
  shiftsRelations: () => shiftsRelations,
  staffAttendance: () => staffAttendance,
  staffAttendanceRelations: () => staffAttendanceRelations,
  staffAttendanceSource: () => staffAttendanceSource,
  staffShifts: () => staffShifts,
  staffShiftsRelations: () => staffShiftsRelations,
  students: () => students,
  studentsRelations: () => studentsRelations,
  transactions: () => transactions,
  transactionsRelations: () => transactionsRelations,
  users: () => users
});
var import_drizzle_orm = require("drizzle-orm");
var import_mysql_core = require("drizzle-orm/mysql-core");
var jsonArray = () => (0, import_mysql_core.customType)({
  dataType() {
    return "json";
  },
  toDriver(value) {
    return JSON.stringify(value ?? []);
  },
  fromDriver(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
});
var stringArray = jsonArray();
var numberArray = jsonArray();
var settings = (0, import_mysql_core.mysqlTable)("settings", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull().unique(),
  centerName: (0, import_mysql_core.varchar)("center_name", { length: 255 }).notNull().default("Schooling"),
  logoUrl: (0, import_mysql_core.text)("logo_url"),
  updatedAt: (0, import_mysql_core.datetime)("updated_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
});
var branches = (0, import_mysql_core.mysqlTable)("branches", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull().default("default-tenant"),
  name: (0, import_mysql_core.varchar)("name", { length: 255 }).notNull(),
  code: (0, import_mysql_core.varchar)("code", { length: 64 }).notNull(),
  phone: (0, import_mysql_core.varchar)("phone", { length: 32 }),
  address: (0, import_mysql_core.text)("address"),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
});
var users = (0, import_mysql_core.mysqlTable)("users", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull().default("default-tenant"),
  uid: (0, import_mysql_core.varchar)("uid", { length: 128 }).notNull().unique(),
  // Firebase Auth UID
  email: (0, import_mysql_core.varchar)("email", { length: 255 }).notNull(),
  name: (0, import_mysql_core.varchar)("name", { length: 255 }),
  employeeCode: (0, import_mysql_core.varchar)("employee_code", { length: 64 }),
  phone: (0, import_mysql_core.varchar)("phone", { length: 32 }),
  role: (0, import_mysql_core.varchar)("role", { length: 32 }).default("staff"),
  // admin, teacher, staff, manager
  // KHÔNG đặt .default([]): MySQL/MariaDB không cho đặt DEFAULT trên cột JSON/TEXT theo
  // cách tương thích. An toàn vì code tạo user luôn truyền `permissions || []`, còn
  // rbac.ts đọc bằng `?.includes(...) ?? false` nên giá trị NULL vẫn xử lý đúng.
  permissions: stringArray("permissions"),
  // Array of allowed feature keys
  branchId: (0, import_mysql_core.int)("branch_id").references(() => branches.id),
  inviteCode: (0, import_mysql_core.varchar)("invite_code", { length: 32 }).unique(),
  // ID định danh FaceID bên Hanet, dùng để khớp lượt quét mặt khi chấm công.
  // Nhân viên đăng ký trong app Hanet với phân loại "Nhân viên" (personType = 0),
  // khác với học viên dùng phân loại "Khách hàng" (personType = 1).
  //
  // Khác bảng students: ở đây dùng unique index thường chứ không cần cột sinh tự động,
  // vì bảng users không có xóa mềm. Cột cho phép NULL, mà unique index không coi các NULL
  // là trùng nhau, nên nhiều nhân viên chưa liên kết khuôn mặt vẫn cùng tồn tại được.
  hanetPersonId: (0, import_mysql_core.varchar)("hanet_person_id", { length: 128 }).unique(),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
});
var classes = (0, import_mysql_core.mysqlTable)("classes", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull().default("default-tenant"),
  branchId: (0, import_mysql_core.int)("branch_id").references(() => branches.id),
  teacherId: (0, import_mysql_core.int)("teacher_id").references(() => users.id),
  name: (0, import_mysql_core.varchar)("name", { length: 255 }).notNull(),
  program: (0, import_mysql_core.varchar)("program", { length: 255 }),
  tuition: (0, import_mysql_core.int)("tuition"),
  feeMethod: (0, import_mysql_core.varchar)("fee_method", { length: 32 }).default("per_session"),
  // 'per_session' | 'per_course'
  sessionsPerMonth: (0, import_mysql_core.int)("sessions_per_month"),
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  (0, import_mysql_core.index)("classes_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("classes_branch_id_idx").on(table.branchId),
  (0, import_mysql_core.index)("classes_teacher_id_idx").on(table.teacherId)
]);
var students = (0, import_mysql_core.mysqlTable)("students", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull().default("default-tenant"),
  name: (0, import_mysql_core.varchar)("name", { length: 255 }).notNull(),
  studentCode: (0, import_mysql_core.varchar)("student_code", { length: 64 }).notNull(),
  phone: (0, import_mysql_core.varchar)("phone", { length: 32 }),
  dob: (0, import_mysql_core.datetime)("dob", { mode: "date" }),
  // Ngày sinh - DATETIME để chứa được năm trước 1970
  gender: (0, import_mysql_core.varchar)("gender", { length: 16 }),
  // Giới tính
  parentName: (0, import_mysql_core.varchar)("parent_name", { length: 255 }),
  // Họ tên phụ huynh
  parentPhone: (0, import_mysql_core.varchar)("parent_phone", { length: 32 }),
  // Điện thoại phụ huynh
  address: (0, import_mysql_core.text)("address"),
  // Địa chỉ
  note: (0, import_mysql_core.text)("note"),
  // Ghi chú
  faceDescriptor: (0, import_mysql_core.text)("face_descriptor"),
  // JSON stringified array of floats
  hanetPersonId: (0, import_mysql_core.varchar)("hanet_person_id", { length: 128 }),
  // ID định danh FaceID bên Hanet
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`),
  // --- Cột sinh tự động, thay cho partial unique index của PostgreSQL ---
  // Cách hoạt động: học viên CÒN hoạt động -> cột chứa giá trị thật -> ràng buộc duy nhất
  // có hiệu lực. Học viên ĐÃ xóa mềm -> cột thành NULL -> mà unique index trong SQL không
  // coi các giá trị NULL là trùng nhau, nên bao nhiêu bản ghi đã xóa cũng được.
  // Kết quả: đúng bằng partial index của PostgreSQL, và mã của học viên đã nghỉ vẫn cấp lại được.
  // Dùng chế độ 'stored' (không phải 'virtual') để chắc chắn đánh được unique index trên MariaDB.
  // Ứng dụng KHÔNG BAO GIỜ ghi vào 2 cột này - MariaDB tự tính từ các cột gốc.
  activeStudentCode: (0, import_mysql_core.varchar)("active_student_code", { length: 64 }).generatedAlwaysAs(import_drizzle_orm.sql`(CASE WHEN is_deleted = 0 THEN student_code ELSE NULL END)`, { mode: "stored" }),
  activeHanetPersonId: (0, import_mysql_core.varchar)("active_hanet_person_id", { length: 128 }).generatedAlwaysAs(import_drizzle_orm.sql`(CASE WHEN is_deleted = 0 THEN hanet_person_id ELSE NULL END)`, { mode: "stored" })
}, (table) => [
  (0, import_mysql_core.index)("students_tenant_id_idx").on(table.tenantId),
  // Mã học viên duy nhất trong phạm vi 1 tenant, chỉ tính học viên chưa bị xóa mềm.
  (0, import_mysql_core.uniqueIndex)("students_tenant_code_active_unique").on(table.tenantId, table.activeStudentCode),
  // 1 FaceID bên Hanet chỉ gắn với đúng 1 học viên đang hoạt động tại 1 thời điểm.
  (0, import_mysql_core.uniqueIndex)("students_hanet_person_id_active_unique").on(table.activeHanetPersonId)
]);
var classEnrollments = (0, import_mysql_core.mysqlTable)("class_enrollments", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull().default("default-tenant"),
  studentId: (0, import_mysql_core.int)("student_id").references(() => students.id).notNull(),
  classId: (0, import_mysql_core.int)("class_id").references(() => classes.id).notNull(),
  tuitionStatus: (0, import_mysql_core.varchar)("tuition_status", { length: 32 }).default("Ch\u01B0a \u0111\xF3ng"),
  tuitionOwed: (0, import_mysql_core.int)("tuition_owed").default(0),
  tuitionFee: (0, import_mysql_core.int)("tuition_fee"),
  entryLevel: (0, import_mysql_core.varchar)("entry_level", { length: 64 }),
  enrollmentDate: (0, import_mysql_core.datetime)("enrollment_date", { mode: "date" }),
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`),
  // Cùng cơ chế cột sinh tự động như bảng students (xem giải thích ở trên).
  activeStudentId: (0, import_mysql_core.int)("active_student_id").generatedAlwaysAs(import_drizzle_orm.sql`(CASE WHEN is_deleted = 0 THEN student_id ELSE NULL END)`, { mode: "stored" }),
  activeClassId: (0, import_mysql_core.int)("active_class_id").generatedAlwaysAs(import_drizzle_orm.sql`(CASE WHEN is_deleted = 0 THEN class_id ELSE NULL END)`, { mode: "stored" })
}, (table) => [
  (0, import_mysql_core.index)("class_enrollments_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("class_enrollments_student_id_idx").on(table.studentId),
  (0, import_mysql_core.index)("class_enrollments_class_id_idx").on(table.classId),
  // Một học viên chỉ có 1 lượt ghi danh "đang hoạt động" cho 1 lớp tại 1 thời điểm.
  (0, import_mysql_core.uniqueIndex)("class_enrollments_student_class_active_unique").on(table.activeStudentId, table.activeClassId)
]);
var attendance = (0, import_mysql_core.mysqlTable)("attendance", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull().default("default-tenant"),
  studentId: (0, import_mysql_core.int)("student_id").references(() => students.id).notNull(),
  classId: (0, import_mysql_core.int)("class_id").references(() => classes.id).notNull(),
  date: (0, import_mysql_core.datetime)("date", { mode: "date" }).notNull(),
  status: (0, import_mysql_core.varchar)("status", { length: 32 }).notNull().default("present"),
  // present, absent_with_permission, absent_without_permission
  homeworkCompleted: (0, import_mysql_core.int)("homework_completed").default(0),
  // 0: No, 1: Yes
  note: (0, import_mysql_core.text)("note"),
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  (0, import_mysql_core.index)("attendance_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("attendance_student_id_idx").on(table.studentId),
  (0, import_mysql_core.index)("attendance_class_id_idx").on(table.classId)
]);
var transactions = (0, import_mysql_core.mysqlTable)("transactions", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull().default("default-tenant"),
  branchId: (0, import_mysql_core.int)("branch_id").references(() => branches.id),
  type: (0, import_mysql_core.varchar)("type", { length: 16 }).notNull(),
  // 'income' | 'expense'
  category: (0, import_mysql_core.varchar)("category", { length: 32 }).notNull(),
  // 'tuition', 'salary', 'infrastructure', 'other'
  amount: (0, import_mysql_core.int)("amount").notNull(),
  date: (0, import_mysql_core.datetime)("date", { mode: "date" }).notNull().default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`),
  note: (0, import_mysql_core.text)("note"),
  studentId: (0, import_mysql_core.int)("student_id").references(() => students.id),
  // Nullable
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  (0, import_mysql_core.index)("transactions_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("transactions_branch_id_idx").on(table.branchId),
  (0, import_mysql_core.index)("transactions_student_id_idx").on(table.studentId)
]);
var branchesRelations = (0, import_drizzle_orm.relations)(branches, ({ many }) => ({
  classes: many(classes),
  transactions: many(transactions)
}));
var classesRelations = (0, import_drizzle_orm.relations)(classes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [classes.branchId],
    references: [branches.id]
  }),
  classEnrollments: many(classEnrollments)
}));
var studentsRelations = (0, import_drizzle_orm.relations)(students, ({ many }) => ({
  transactions: many(transactions),
  classEnrollments: many(classEnrollments)
}));
var classEnrollmentsRelations = (0, import_drizzle_orm.relations)(classEnrollments, ({ one }) => ({
  student: one(students, {
    fields: [classEnrollments.studentId],
    references: [students.id]
  }),
  class: one(classes, {
    fields: [classEnrollments.classId],
    references: [classes.id]
  })
}));
var transactionsRelations = (0, import_drizzle_orm.relations)(transactions, ({ one }) => ({
  branch: one(branches, {
    fields: [transactions.branchId],
    references: [branches.id]
  }),
  student: one(students, {
    fields: [transactions.studentId],
    references: [students.id]
  })
}));
var promotions = (0, import_mysql_core.mysqlTable)("promotions", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull(),
  name: (0, import_mysql_core.varchar)("name", { length: 255 }).notNull(),
  discountType: (0, import_mysql_core.varchar)("discount_type", { length: 16 }).notNull(),
  // 'percentage' | 'fixed'
  discountValue: (0, import_mysql_core.int)("discount_value").notNull(),
  branchIds: numberArray("branch_ids").notNull(),
  startDate: (0, import_mysql_core.datetime)("start_date", { mode: "date" }),
  endDate: (0, import_mysql_core.datetime)("end_date", { mode: "date" }),
  isActive: (0, import_mysql_core.boolean)("is_active").default(true).notNull(),
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`),
  updatedAt: (0, import_mysql_core.datetime)("updated_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  (0, import_mysql_core.index)("promotions_tenant_id_idx").on(table.tenantId)
]);
var licenses = (0, import_mysql_core.mysqlTable)("licenses", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  code: (0, import_mysql_core.varchar)("code", { length: 64 }).notNull(),
  customerName: (0, import_mysql_core.varchar)("customer_name", { length: 255 }),
  // ghi chú tên khách hàng/trung tâm
  note: (0, import_mysql_core.text)("note"),
  expiresAt: (0, import_mysql_core.datetime)("expires_at", { mode: "date" }).notNull(),
  // hết hạn -> khóa trung tâm
  usedAt: (0, import_mysql_core.datetime)("used_at", { mode: "date" }),
  // null = chưa ai dùng
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }),
  // tenant đã kích hoạt bằng mã này
  isRevoked: (0, import_mysql_core.boolean)("is_revoked").notNull().default(false),
  // thu hồi thủ công
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  (0, import_mysql_core.uniqueIndex)("licenses_code_unique").on(table.code),
  // 1 tenant chỉ gắn với 1 giấy phép -> gia hạn nghĩa là cập nhật expiresAt của chính dòng này.
  // Cột cho phép NULL, mà unique index không coi các NULL là trùng nhau, nên vẫn tồn tại
  // được nhiều mã CHƯA sử dụng cùng lúc - đúng như hành vi ở bản PostgreSQL.
  (0, import_mysql_core.uniqueIndex)("licenses_tenant_id_unique").on(table.tenantId)
]);
var HANET_PENDING_CHECKIN_REASONS = [
  "unlinked_face",
  // personID chưa được gán cho học viên nào trong hệ thống
  "no_active_class",
  // đã tìm ra học viên, nhưng học viên không còn ghi danh lớp nào
  "no_open_session",
  // có lớp nhưng không lớp nào đang mở phiên điểm danh
  "multiple_open_sessions"
  // nhiều hơn 1 lớp của học viên cùng đang mở phiên
];
var attendanceSessions = (0, import_mysql_core.mysqlTable)("attendance_sessions", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull(),
  classId: (0, import_mysql_core.int)("class_id").references(() => classes.id).notNull(),
  openedBy: (0, import_mysql_core.int)("opened_by").references(() => users.id).notNull(),
  // Giáo viên THỰC TẾ dạy buổi này. Tách khỏi openedBy vì người bấm mở phiên có thể là
  // lễ tân chứ không phải người đứng lớp, và vì có trường hợp dạy thay. Mặc định giao diện
  // điền sẵn giáo viên phụ trách lớp, người dùng đổi được.
  taughtBy: (0, import_mysql_core.int)("taught_by").references(() => users.id),
  openedAt: (0, import_mysql_core.datetime)("opened_at", { mode: "date" }).notNull().default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`),
  closedAt: (0, import_mysql_core.datetime)("closed_at", { mode: "date" }),
  // null = chưa chủ động đóng
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  (0, import_mysql_core.index)("attendance_sessions_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("attendance_sessions_class_id_idx").on(table.classId)
]);
var hanetPendingCheckins = (0, import_mysql_core.mysqlTable)("hanet_pending_checkins", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull(),
  hanetRecordId: (0, import_mysql_core.varchar)("hanet_record_id", { length: 128 }).notNull(),
  // chống xử lý trùng nếu webhook gọi lại
  hanetPersonId: (0, import_mysql_core.varchar)("hanet_person_id", { length: 128 }).notNull(),
  personName: (0, import_mysql_core.varchar)("person_name", { length: 255 }),
  // tên Hanet gửi kèm
  studentId: (0, import_mysql_core.int)("student_id").references(() => students.id),
  // null nếu chưa liên kết được học viên
  candidateClassIds: numberArray("candidate_class_ids"),
  // các lớp khả dĩ, để UI cho chọn nhanh
  checkinTime: (0, import_mysql_core.datetime)("checkin_time", { mode: "date" }).notNull(),
  imageUrl: (0, import_mysql_core.text)("image_url"),
  // detected_image_url Hanet gửi kèm, để đối chiếu bằng mắt
  reason: (0, import_mysql_core.mysqlEnum)("reason", HANET_PENDING_CHECKIN_REASONS).notNull(),
  resolvedAt: (0, import_mysql_core.datetime)("resolved_at", { mode: "date" }),
  resolvedClassId: (0, import_mysql_core.int)("resolved_class_id").references(() => classes.id),
  resolvedBy: (0, import_mysql_core.int)("resolved_by").references(() => users.id),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  (0, import_mysql_core.index)("hanet_pending_checkins_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("hanet_pending_checkins_student_id_idx").on(table.studentId),
  (0, import_mysql_core.uniqueIndex)("hanet_pending_checkins_record_id_unique").on(table.hanetRecordId)
]);
var attendanceSessionsRelations = (0, import_drizzle_orm.relations)(attendanceSessions, ({ one }) => ({
  class: one(classes, {
    fields: [attendanceSessions.classId],
    references: [classes.id]
  }),
  openedByUser: one(users, {
    fields: [attendanceSessions.openedBy],
    references: [users.id]
  })
}));
var hanetPendingCheckinsRelations = (0, import_drizzle_orm.relations)(hanetPendingCheckins, ({ one }) => ({
  student: one(students, {
    fields: [hanetPendingCheckins.studentId],
    references: [students.id]
  }),
  resolvedClass: one(classes, {
    fields: [hanetPendingCheckins.resolvedClassId],
    references: [classes.id]
  })
}));
var shifts = (0, import_mysql_core.mysqlTable)("shifts", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull(),
  name: (0, import_mysql_core.varchar)("name", { length: 100 }).notNull(),
  // Kiểu TIME của MySQL, driver trả về chuỗi dạng "07:30:00". Không lưu kèm ngày nên
  // không dính chuyện múi giờ - đây chỉ là "giờ trong ngày", không phải một thời điểm.
  startTime: (0, import_mysql_core.time)("start_time").notNull(),
  endTime: (0, import_mysql_core.time)("end_time").notNull(),
  // Đánh dấu ca hành chính (theo cách phân loại trong app camera). Chỉ để phân nhóm khi
  // hiển thị, không ảnh hưởng cách tính công.
  isAdministrative: (0, import_mysql_core.boolean)("is_administrative").notNull().default(false),
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`)
}, (table) => [
  (0, import_mysql_core.index)("shifts_tenant_id_idx").on(table.tenantId)
]);
var classSchedules = (0, import_mysql_core.mysqlTable)("class_schedules", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull(),
  classId: (0, import_mysql_core.int)("class_id").references(() => classes.id).notNull(),
  shiftId: (0, import_mysql_core.int)("shift_id").references(() => shifts.id).notNull(),
  // Quy ước: 1 = Thứ 2, 2 = Thứ 3, ... 6 = Thứ 7, 7 = Chủ nhật.
  // Dùng quy ước này thay vì kiểu 0 = Chủ nhật của JavaScript, vì người Việt đọc lịch
  // bắt đầu từ thứ 2 - tránh lệch một ngày khi hiển thị.
  dayOfWeek: (0, import_mysql_core.int)("day_of_week").notNull(),
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`),
  // Cột sinh tự động để chống xếp trùng: cùng một lớp không thể có hai dòng lịch giống hệt
  // (cùng thứ, cùng ca) trong số các dòng chưa bị xóa mềm.
  activeScheduleKey: (0, import_mysql_core.varchar)("active_schedule_key", { length: 64 }).generatedAlwaysAs(import_drizzle_orm.sql`(CASE WHEN is_deleted = 0 THEN CONCAT(class_id, '-', day_of_week, '-', shift_id) ELSE NULL END)`, { mode: "stored" })
}, (table) => [
  (0, import_mysql_core.index)("class_schedules_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("class_schedules_class_id_idx").on(table.classId),
  (0, import_mysql_core.index)("class_schedules_shift_id_idx").on(table.shiftId),
  (0, import_mysql_core.index)("class_schedules_day_idx").on(table.dayOfWeek),
  (0, import_mysql_core.uniqueIndex)("class_schedules_active_unique").on(table.activeScheduleKey)
]);
var staffShifts = (0, import_mysql_core.mysqlTable)("staff_shifts", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull(),
  userId: (0, import_mysql_core.int)("user_id").references(() => users.id).notNull(),
  shiftId: (0, import_mysql_core.int)("shift_id").references(() => shifts.id).notNull(),
  // Ngày làm việc. Dùng kiểu DATE (không kèm giờ) để so sánh theo ngày cho gọn.
  workDate: (0, import_mysql_core.date)("work_date", { mode: "string" }).notNull(),
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`),
  // Chống phân trùng: cùng nhân viên, cùng ngày, cùng ca thì chỉ một dòng.
  activeAssignmentKey: (0, import_mysql_core.varchar)("active_assignment_key", { length: 64 }).generatedAlwaysAs(import_drizzle_orm.sql`(CASE WHEN is_deleted = 0 THEN CONCAT(user_id, '-', work_date, '-', shift_id) ELSE NULL END)`, { mode: "stored" })
}, (table) => [
  (0, import_mysql_core.index)("staff_shifts_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("staff_shifts_user_id_idx").on(table.userId),
  (0, import_mysql_core.index)("staff_shifts_shift_id_idx").on(table.shiftId),
  (0, import_mysql_core.index)("staff_shifts_work_date_idx").on(table.workDate),
  (0, import_mysql_core.uniqueIndex)("staff_shifts_active_unique").on(table.activeAssignmentKey)
]);
var staffAttendanceSource = ["camera", "manual"];
var staffAttendance = (0, import_mysql_core.mysqlTable)("staff_attendance", {
  id: (0, import_mysql_core.int)("id").autoincrement().primaryKey(),
  tenantId: (0, import_mysql_core.varchar)("tenant_id", { length: 128 }).notNull(),
  userId: (0, import_mysql_core.int)("user_id").references(() => users.id).notNull(),
  workDate: (0, import_mysql_core.date)("work_date", { mode: "string" }).notNull(),
  checkInTime: (0, import_mysql_core.datetime)("check_in_time", { mode: "date" }),
  checkOutTime: (0, import_mysql_core.datetime)("check_out_time", { mode: "date" }),
  // Ca được dùng làm mốc đối chiếu khi tính đi muộn / về sớm.
  // Lưu lại ID ca thay vì chỉ tra lúc xem báo cáo, để nếu sau này lịch phân ca bị sửa thì
  // bản ghi công cũ vẫn giữ nguyên căn cứ đã dùng - đúng nguyên tắc của dữ liệu chấm công.
  shiftId: (0, import_mysql_core.int)("shift_id").references(() => shifts.id),
  // Số phút đi muộn / về sớm, tính tại thời điểm ghi nhận so với ca ở trên.
  // Lưu sẵn vì cùng lý do: đổi lịch phân ca về sau không được làm thay đổi công đã chốt.
  lateMinutes: (0, import_mysql_core.int)("late_minutes").notNull().default(0),
  earlyLeaveMinutes: (0, import_mysql_core.int)("early_leave_minutes").notNull().default(0),
  source: (0, import_mysql_core.mysqlEnum)("source", staffAttendanceSource).notNull().default("camera"),
  note: (0, import_mysql_core.text)("note"),
  isDeleted: (0, import_mysql_core.boolean)("is_deleted").notNull().default(false),
  deletedAt: (0, import_mysql_core.datetime)("deleted_at", { mode: "date" }),
  createdAt: (0, import_mysql_core.datetime)("created_at", { mode: "date" }).default(import_drizzle_orm.sql`CURRENT_TIMESTAMP`),
  // Mỗi nhân viên mỗi ngày chỉ một bản ghi công đang hiệu lực.
  activeAttendanceKey: (0, import_mysql_core.varchar)("active_attendance_key", { length: 64 }).generatedAlwaysAs(import_drizzle_orm.sql`(CASE WHEN is_deleted = 0 THEN CONCAT(user_id, '-', work_date) ELSE NULL END)`, { mode: "stored" })
}, (table) => [
  (0, import_mysql_core.index)("staff_attendance_tenant_id_idx").on(table.tenantId),
  (0, import_mysql_core.index)("staff_attendance_user_id_idx").on(table.userId),
  (0, import_mysql_core.index)("staff_attendance_work_date_idx").on(table.workDate),
  (0, import_mysql_core.uniqueIndex)("staff_attendance_active_unique").on(table.activeAttendanceKey)
]);
var shiftsRelations = (0, import_drizzle_orm.relations)(shifts, ({ many }) => ({
  classSchedules: many(classSchedules),
  staffShifts: many(staffShifts)
}));
var classSchedulesRelations = (0, import_drizzle_orm.relations)(classSchedules, ({ one }) => ({
  class: one(classes, {
    fields: [classSchedules.classId],
    references: [classes.id]
  }),
  shift: one(shifts, {
    fields: [classSchedules.shiftId],
    references: [shifts.id]
  })
}));
var staffShiftsRelations = (0, import_drizzle_orm.relations)(staffShifts, ({ one }) => ({
  user: one(users, {
    fields: [staffShifts.userId],
    references: [users.id]
  }),
  shift: one(shifts, {
    fields: [staffShifts.shiftId],
    references: [shifts.id]
  })
}));
var staffAttendanceRelations = (0, import_drizzle_orm.relations)(staffAttendance, ({ one }) => ({
  user: one(users, {
    fields: [staffAttendance.userId],
    references: [users.id]
  }),
  shift: one(shifts, {
    fields: [staffAttendance.shiftId],
    references: [shifts.id]
  })
}));

// src/db/index.ts
var createPool = () => {
  if (!global._mysqlPool) {
    global._mysqlPool = import_promise.default.createPool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 3306,
      // BẮT BUỘC: máy chủ MariaDB của hosting đang để mặc định latin1 (cp1252),
      // bảng mã đó KHÔNG chứa được tiếng Việt có dấu. Nếu thiếu dòng này, tên học viên
      // và các chuỗi tiếng Việt sẽ lưu thành ký tự rác mà không báo lỗi gì.
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 15e3
    });
  }
  return global._mysqlPool;
};
var pool = createPool();
var poolEmitter = pool;
if (typeof poolEmitter.on === "function") {
  poolEmitter.on("error", (err) => {
    console.error("Unexpected error on idle SQL pool connection:", err);
  });
}
var db = (0, import_mysql2.drizzle)(pool, { schema: schema_exports, mode: "default" });

// src/middleware/auth.ts
var import_drizzle_orm2 = require("drizzle-orm");
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    try {
      const dbUserResult = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.uid, decodedToken.uid));
      if (dbUserResult.length > 0) {
        req.dbUser = dbUserResult[0];
      }
    } catch (dbErr) {
      console.error("Error fetching dbUser in auth middleware", dbErr);
    }
    if (req.dbUser?.tenantId) {
      try {
        const licenseRows = await db.select().from(licenses).where((0, import_drizzle_orm2.eq)(licenses.tenantId, req.dbUser.tenantId)).limit(1);
        const license = licenseRows[0];
        if (!license) {
          return res.status(403).json({
            error: "Trung t\xE2m ch\u01B0a \u0111\u01B0\u1EE3c k\xEDch ho\u1EA1t. Vui l\xF2ng li\xEAn h\u1EC7 nh\xE0 cung c\u1EA5p ph\u1EA7n m\u1EC1m.",
            licenseStatus: "missing"
          });
        }
        if (license.isRevoked) {
          return res.status(403).json({
            error: "Gi\u1EA5y ph\xE9p \u0111\xE3 b\u1ECB thu h\u1ED3i. Vui l\xF2ng li\xEAn h\u1EC7 nh\xE0 cung c\u1EA5p ph\u1EA7n m\u1EC1m.",
            licenseStatus: "revoked"
          });
        }
        if (license.expiresAt.getTime() < Date.now()) {
          return res.status(403).json({
            error: "Gi\u1EA5y ph\xE9p s\u1EED d\u1EE5ng \u0111\xE3 h\u1EBFt h\u1EA1n. Vui l\xF2ng gia h\u1EA1n \u0111\u1EC3 ti\u1EBFp t\u1EE5c s\u1EED d\u1EE5ng.",
            licenseStatus: "expired",
            expiresAt: license.expiresAt
          });
        }
      } catch (licenseErr) {
        console.error("Error checking license in auth middleware", licenseErr);
      }
    }
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// src/middleware/rbac.ts
function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = req.dbUser?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n th\u1EF1c hi\u1EC7n thao t\xE1c n\xE0y." });
    }
    next();
  };
}
function requirePermission(permissionKey) {
  return (req, res, next) => {
    const isAdmin = req.dbUser?.role === "admin";
    const hasPermission = req.dbUser?.permissions?.includes(permissionKey) ?? false;
    if (!isAdmin && !hasPermission) {
      return res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n." });
    }
    next();
  };
}

// src/db/helpers.ts
var import_drizzle_orm3 = require("drizzle-orm");
async function updateReturning(executor, table, values, where) {
  const targets = await executor.select({ id: table.id }).from(table).where(where);
  if (targets.length === 0) return [];
  const ids = targets.map((row) => row.id);
  await executor.update(table).set(values).where((0, import_drizzle_orm3.inArray)(table.id, ids));
  const rows = await executor.select().from(table).where((0, import_drizzle_orm3.inArray)(table.id, ids));
  return rows;
}
async function insertReturning(executor, table, values) {
  const [result] = await executor.insert(table).values(values);
  const rows = await executor.select().from(table).where((0, import_drizzle_orm3.eq)(table.id, result.insertId));
  return rows[0];
}

// src/db/users.ts
var import_drizzle_orm4 = require("drizzle-orm");
async function getOrCreateUser(uid, email, name) {
  const userByUid = await db.select().from(users).where((0, import_drizzle_orm4.eq)(users.uid, uid)).limit(1);
  if (userByUid.length > 0) {
    return userByUid[0];
  }
  const existingUser = await db.select().from(users).where((0, import_drizzle_orm4.eq)(users.email, email)).limit(1);
  if (existingUser.length > 0) {
    const user = existingUser[0];
    if (user.uid !== uid || !user.name && name) {
      const result = await updateReturning(
        db,
        users,
        { uid, name: user.name || name || null },
        (0, import_drizzle_orm4.eq)(users.id, user.id)
      );
      return result[0] ?? user;
    }
    return user;
  }
  return { needsOnboarding: true };
}

// server.ts
var import_drizzle_orm5 = require("drizzle-orm");
var import_auth3 = require("firebase-admin/auth");

// src/lib/hanet.ts
var import_crypto = __toESM(require("crypto"), 1);
var HANET_RECOGNIZED_PERSON_TYPES = [0, 1, "0", "1"];
function verifyHanetHash(id, hash, clientSecret) {
  if (!id || !hash || !clientSecret) return false;
  const expected = import_crypto.default.createHash("md5").update(clientSecret + id).digest("hex");
  return expected.toLowerCase() === hash.toLowerCase();
}
function parseHanetTime(time2) {
  if (time2 === void 0 || time2 === null) return /* @__PURE__ */ new Date();
  const ms = typeof time2 === "number" ? time2 : Number(time2);
  const parsed = new Date(ms);
  return isNaN(parsed.getTime()) ? /* @__PURE__ */ new Date() : parsed;
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3e3;
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.post("/api/auth/sync", requireAuth, async (req, res) => {
    try {
      const user = req.user;
      const dbUser = await getOrCreateUser(user.uid, user.email || "", user.name);
      res.json(dbUser);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/onboarding/create-tenant", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split("Bearer ")[1];
      const authReq = req;
      let decodedToken;
      try {
        decodedToken = await (0, import_auth3.getAuth)().verifyIdToken(token);
      } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
      }
      const { uid, email, name } = decodedToken;
      const tenantId = uid;
      const { licenseCode } = req.body;
      if (!licenseCode || typeof licenseCode !== "string") {
        return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp m\xE3 k\xEDch ho\u1EA1t." });
      }
      const normalizedCode = licenseCode.trim().toUpperCase();
      const licenseRows = await db.select().from(licenses).where((0, import_drizzle_orm5.eq)(licenses.code, normalizedCode)).limit(1);
      const license = licenseRows[0];
      if (!license) {
        return res.status(400).json({ error: "M\xE3 k\xEDch ho\u1EA1t kh\xF4ng h\u1EE3p l\u1EC7." });
      }
      if (license.isRevoked) {
        return res.status(400).json({ error: "M\xE3 k\xEDch ho\u1EA1t \u0111\xE3 b\u1ECB thu h\u1ED3i." });
      }
      if (license.usedAt || license.tenantId) {
        return res.status(400).json({ error: "M\xE3 k\xEDch ho\u1EA1t n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng." });
      }
      if (license.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ error: "M\xE3 k\xEDch ho\u1EA1t \u0111\xE3 h\u1EBFt h\u1EA1n." });
      }
      const result = await db.transaction(async (tx) => {
        const inserted = await insertReturning(tx, users, {
          uid,
          email: email || "",
          name: name || null,
          tenantId,
          role: "admin"
        });
        const [claimResult] = await tx.update(licenses).set({ usedAt: /* @__PURE__ */ new Date(), tenantId }).where((0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(licenses.id, license.id),
          (0, import_drizzle_orm5.isNull)(licenses.usedAt),
          (0, import_drizzle_orm5.isNull)(licenses.tenantId)
        ));
        if (claimResult.affectedRows === 0) {
          throw new Error("LICENSE_ALREADY_CLAIMED");
        }
        return inserted;
      });
      res.json(result);
    } catch (error) {
      if (error?.message === "LICENSE_ALREADY_CLAIMED") {
        return res.status(400).json({ error: "M\xE3 k\xEDch ho\u1EA1t n\xE0y v\u1EEBa \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng. Vui l\xF2ng ki\u1EC3m tra l\u1EA1i." });
      }
      console.error(error);
      res.status(500).json({ error: "Failed to create center" });
    }
  });
  app.post("/api/onboarding/join-tenant", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split("Bearer ")[1];
      let decodedToken;
      try {
        decodedToken = await (0, import_auth3.getAuth)().verifyIdToken(token);
      } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
      }
      const { inviteCode } = req.body;
      const { uid, email, name } = decodedToken;
      const existingInvite = await db.select().from(users).where((0, import_drizzle_orm5.eq)(users.inviteCode, inviteCode)).limit(1);
      if (existingInvite.length === 0) {
        return res.status(404).json({ error: "M\xE3 l\u1EDDi m\u1EDDi kh\xF4ng h\u1EE3p l\u1EC7" });
      }
      const user = existingInvite[0];
      const licenseRows = await db.select().from(licenses).where((0, import_drizzle_orm5.eq)(licenses.tenantId, user.tenantId)).limit(1);
      const license = licenseRows[0];
      if (!license || license.isRevoked || license.expiresAt.getTime() < Date.now()) {
        return res.status(403).json({ error: "Trung t\xE2m n\xE0y hi\u1EC7n kh\xF4ng ho\u1EA1t \u0111\u1ED9ng. Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn trung t\xE2m." });
      }
      const result = await updateReturning(
        db,
        users,
        { uid, name: name || user.name || null, inviteCode: null },
        (0, import_drizzle_orm5.eq)(users.id, user.id)
      );
      res.json(result[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to join center" });
    }
  });
  const HANET_SESSION_EXPIRY_HOURS = 3;
  app.post("/api/webhooks/hanet", async (req, res) => {
    try {
      const payload = req.body;
      console.error("[HANET] nhan:", JSON.stringify({
        id: payload.id,
        data_type: payload.data_type,
        personID: payload.personID,
        personName: payload.personName,
        personType: payload.personType
      }));
      const clientSecret = process.env.HANET_CLIENT_SECRET;
      if (!clientSecret) {
        console.error("Hanet webhook: thi\u1EBFu HANET_CLIENT_SECRET trong .env, t\u1EEB ch\u1ED1i to\xE0n b\u1ED9 request.");
        return res.status(500).json({ error: "Server misconfigured" });
      }
      if (!verifyHanetHash(payload.id, payload.hash, clientSecret)) {
        console.warn("Hanet webhook: hash kh\xF4ng h\u1EE3p l\u1EC7, t\u1EEB ch\u1ED1i request.", { id: payload.id });
        return res.status(401).json({ error: "Invalid signature" });
      }
      if (payload.data_type !== "log") {
        console.log(`Hanet webhook: nh\u1EADn s\u1EF1 ki\u1EC7n data_type="${payload.data_type}" action_type="${payload.action_type}" - ch\u1EC9 ghi nh\u1EADn, ch\u01B0a x\u1EED l\xFD s\xE2u.`);
        return res.status(200).json({ received: true });
      }
      const { personID, personType, personName, detected_image_url } = payload;
      const checkinTime = parseHanetTime(payload.time);
      if (!personID || personType === void 0 || !HANET_RECOGNIZED_PERSON_TYPES.includes(personType)) {
        return res.status(200).json({ received: true, processed: false });
      }
      const matchedStudents = await db.select().from(students).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(students.hanetPersonId, personID), (0, import_drizzle_orm5.eq)(students.isDeleted, false))).limit(1);
      if (matchedStudents.length === 0) {
        const fallbackTenantId = process.env.HANET_DEFAULT_TENANT_ID || "default-tenant";
        await db.insert(hanetPendingCheckins).values({
          tenantId: fallbackTenantId,
          hanetRecordId: payload.id,
          hanetPersonId: personID,
          personName: personName || null,
          studentId: null,
          candidateClassIds: null,
          checkinTime,
          imageUrl: detected_image_url || null,
          reason: "unlinked_face"
        }).onDuplicateKeyUpdate({ set: { hanetRecordId: import_drizzle_orm5.sql`hanet_record_id` } });
        return res.status(200).json({ received: true, processed: false });
      }
      const student = matchedStudents[0];
      const tenantId = student.tenantId;
      const enrollments = await db.select({ classId: classEnrollments.classId }).from(classEnrollments).where((0, import_drizzle_orm5.and)(
        (0, import_drizzle_orm5.eq)(classEnrollments.studentId, student.id),
        (0, import_drizzle_orm5.eq)(classEnrollments.tenantId, tenantId),
        (0, import_drizzle_orm5.eq)(classEnrollments.isDeleted, false)
      ));
      if (enrollments.length === 0) {
        await db.insert(hanetPendingCheckins).values({
          tenantId,
          hanetRecordId: payload.id,
          hanetPersonId: personID,
          personName: personName || student.name,
          studentId: student.id,
          candidateClassIds: [],
          checkinTime,
          imageUrl: detected_image_url || null,
          reason: "no_active_class"
        }).onDuplicateKeyUpdate({ set: { hanetRecordId: import_drizzle_orm5.sql`hanet_record_id` } });
        return res.status(200).json({ received: true, processed: false });
      }
      const candidateClassIds = enrollments.map((e) => e.classId);
      const sessionExpiry = new Date(Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1e3);
      const openSessions = await db.select().from(attendanceSessions).where((0, import_drizzle_orm5.and)(
        (0, import_drizzle_orm5.inArray)(attendanceSessions.classId, candidateClassIds),
        (0, import_drizzle_orm5.eq)(attendanceSessions.tenantId, tenantId),
        (0, import_drizzle_orm5.isNull)(attendanceSessions.closedAt),
        (0, import_drizzle_orm5.gte)(attendanceSessions.openedAt, sessionExpiry)
      ));
      if (openSessions.length !== 1) {
        await db.insert(hanetPendingCheckins).values({
          tenantId,
          hanetRecordId: payload.id,
          hanetPersonId: personID,
          personName: personName || student.name,
          studentId: student.id,
          candidateClassIds,
          checkinTime,
          imageUrl: detected_image_url || null,
          reason: openSessions.length === 0 ? "no_open_session" : "multiple_open_sessions"
        }).onDuplicateKeyUpdate({ set: { hanetRecordId: import_drizzle_orm5.sql`hanet_record_id` } });
        return res.status(200).json({ received: true, processed: false });
      }
      const matchedClassId = openSessions[0].classId;
      const startOfDay = new Date(checkinTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(checkinTime);
      endOfDay.setHours(23, 59, 59, 999);
      await db.transaction(async (tx) => {
        await tx.update(attendance).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(attendance.tenantId, tenantId),
          (0, import_drizzle_orm5.eq)(attendance.studentId, student.id),
          (0, import_drizzle_orm5.eq)(attendance.classId, matchedClassId),
          (0, import_drizzle_orm5.eq)(attendance.isDeleted, false),
          (0, import_drizzle_orm5.gte)(attendance.date, startOfDay),
          (0, import_drizzle_orm5.lte)(attendance.date, endOfDay)
        ));
        await tx.insert(attendance).values({
          tenantId,
          studentId: student.id,
          classId: matchedClassId,
          date: checkinTime,
          status: "present",
          note: "\u0110i\u1EC3m danh t\u1EF1 \u0111\u1ED9ng qua camera Hanet"
        });
      });
      res.status(200).json({ received: true, processed: true });
    } catch (error) {
      console.error("L\u1ED7i x\u1EED l\xFD webhook Hanet:", error);
      res.status(500).json({ error: "Internal error" });
    }
  });
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      let query = db.select().from(users).where((0, import_drizzle_orm5.eq)(users.tenantId, tenantId));
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        query = db.select().from(users).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(users.tenantId, tenantId), (0, import_drizzle_orm5.eq)(users.branchId, req.dbUser.branchId)));
      }
      const result = await query;
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  app.post("/api/users", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { email, name, role, employeeCode, branchId, permissions } = req.body;
      const existing = await db.select().from(users).where((0, import_drizzle_orm5.eq)(users.email, email)).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Email n\xE0y \u0111\xE3 t\u1ED3n t\u1EA1i trong h\u1EC7 th\u1ED1ng." });
      }
      const pendingUid = `pending_${Date.now()}_${email}`;
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const result = await insertReturning(db, users, {
        uid: pendingUid,
        email,
        name: name || null,
        role: role || "staff",
        employeeCode: employeeCode || null,
        branchId: branchId ? parseInt(branchId) : null,
        permissions: permissions || [],
        inviteCode,
        tenantId
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  app.put("/api/users/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { id } = req.params;
      const { role, permissions } = req.body;
      const result = await updateReturning(
        db,
        users,
        {
          ...role && { role },
          ...permissions && { permissions }
        },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(users.id, parseInt(id)), (0, import_drizzle_orm5.eq)(users.tenantId, tenantId))
      );
      if (!result.length) {
        return res.status(404).json({ error: "User not found or unauthorized" });
      }
      res.json(result[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      let result = await db.select().from(settings).where((0, import_drizzle_orm5.eq)(settings.tenantId, tenantId)).limit(1);
      if (result.length === 0) {
        const newSettings = await insertReturning(db, settings, {
          tenantId,
          centerName: "Schooling",
          logoUrl: null
        });
        return res.json(newSettings);
      }
      res.json(result[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });
  app.put("/api/settings", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { centerName, logoUrl } = req.body;
      let result = await db.select().from(settings).where((0, import_drizzle_orm5.eq)(settings.tenantId, tenantId)).limit(1);
      if (result.length === 0) {
        const newSettings = await insertReturning(db, settings, {
          tenantId,
          centerName,
          logoUrl
        });
        return res.json(newSettings);
      } else {
        const updatedSettings = await updateReturning(
          db,
          settings,
          { centerName, logoUrl, updatedAt: /* @__PURE__ */ new Date() },
          (0, import_drizzle_orm5.eq)(settings.tenantId, tenantId)
        );
        return res.json(updatedSettings[0]);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });
  app.get("/api/branches", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      let query = db.select().from(branches).where((0, import_drizzle_orm5.eq)(branches.tenantId, tenantId));
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        query = db.select().from(branches).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(branches.tenantId, tenantId), (0, import_drizzle_orm5.eq)(branches.id, req.dbUser.branchId)));
      }
      const result = await query;
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });
  app.post("/api/branches", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { name, code, phone, address } = req.body;
      const result = await insertReturning(db, branches, { tenantId, name, code, phone, address });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create branch" });
    }
  });
  app.put("/api/branches/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { name, code, phone, address } = req.body;
      const branchId = parseInt(req.params.id);
      const result = await updateReturning(
        db,
        branches,
        { name, code, phone, address },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(branches.id, branchId), (0, import_drizzle_orm5.eq)(branches.tenantId, tenantId))
      );
      if (result.length === 0) {
        return res.status(404).json({ error: "Branch not found or unauthorized" });
      }
      res.json(result[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update branch" });
    }
  });
  const normalizeShiftTime = (value) => {
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = match[3] ? Number(match[3]) : 0;
    if (hour > 23 || minute > 59 || second > 59) return null;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  };
  app.get("/api/shifts", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const result = await db.select().from(shifts).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(shifts.tenantId, tenantId), (0, import_drizzle_orm5.eq)(shifts.isDeleted, false))).orderBy(shifts.startTime);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });
  app.post("/api/shifts", requireAuth, requirePermission("/shifts"), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { name, startTime, endTime, isAdministrative } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn ca." });
      }
      const start = normalizeShiftTime(startTime);
      const end = normalizeShiftTime(endTime);
      if (!start || !end) {
        return res.status(400).json({ error: "Gi\u1EDD kh\xF4ng h\u1EE3p l\u1EC7. \u0110\u1ECBnh d\u1EA1ng \u0111\xFAng l\xE0 HH:MM." });
      }
      if (end <= start) {
        return res.status(400).json({ error: "Gi\u1EDD k\u1EBFt th\xFAc ph\u1EA3i sau gi\u1EDD b\u1EAFt \u0111\u1EA7u." });
      }
      const result = await insertReturning(db, shifts, {
        tenantId,
        name: name.trim(),
        startTime: start,
        endTime: end,
        isAdministrative: !!isAdministrative
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create shift" });
    }
  });
  app.put("/api/shifts/:id", requireAuth, requirePermission("/shifts"), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const shiftId = parseInt(req.params.id);
      const { name, startTime, endTime, isAdministrative } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn ca." });
      }
      const start = normalizeShiftTime(startTime);
      const end = normalizeShiftTime(endTime);
      if (!start || !end) {
        return res.status(400).json({ error: "Gi\u1EDD kh\xF4ng h\u1EE3p l\u1EC7. \u0110\u1ECBnh d\u1EA1ng \u0111\xFAng l\xE0 HH:MM." });
      }
      if (end <= start) {
        return res.status(400).json({ error: "Gi\u1EDD k\u1EBFt th\xFAc ph\u1EA3i sau gi\u1EDD b\u1EAFt \u0111\u1EA7u." });
      }
      const result = await updateReturning(
        db,
        shifts,
        {
          name: name.trim(),
          startTime: start,
          endTime: end,
          isAdministrative: !!isAdministrative
        },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(shifts.id, shiftId), (0, import_drizzle_orm5.eq)(shifts.tenantId, tenantId), (0, import_drizzle_orm5.eq)(shifts.isDeleted, false))
      );
      if (result.length === 0) {
        return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ca l\xE0m vi\u1EC7c." });
      }
      res.json(result[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update shift" });
    }
  });
  app.delete("/api/shifts/:id", requireAuth, requirePermission("/shifts"), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const shiftId = parseInt(req.params.id);
      const [usedInClasses, usedInRoster, usedInTimesheet] = await Promise.all([
        db.select({ id: classSchedules.id }).from(classSchedules).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classSchedules.shiftId, shiftId), (0, import_drizzle_orm5.eq)(classSchedules.isDeleted, false))),
        db.select({ id: staffShifts.id }).from(staffShifts).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(staffShifts.shiftId, shiftId), (0, import_drizzle_orm5.eq)(staffShifts.isDeleted, false))),
        db.select({ id: staffAttendance.id }).from(staffAttendance).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(staffAttendance.shiftId, shiftId), (0, import_drizzle_orm5.eq)(staffAttendance.isDeleted, false)))
      ]);
      if (usedInClasses.length > 0 || usedInRoster.length > 0 || usedInTimesheet.length > 0) {
        const reasons = [];
        if (usedInClasses.length > 0) reasons.push(`${usedInClasses.length} l\u1ECBch h\u1ECDc`);
        if (usedInRoster.length > 0) reasons.push(`${usedInRoster.length} l\u01B0\u1EE3t ph\xE2n ca nh\xE2n vi\xEAn`);
        if (usedInTimesheet.length > 0) reasons.push(`${usedInTimesheet.length} b\u1EA3n ghi ch\u1EA5m c\xF4ng`);
        return res.status(400).json({
          error: `Kh\xF4ng th\u1EC3 x\xF3a v\xEC ca n\xE0y \u0111ang \u0111\u01B0\u1EE3c d\xF9ng \u1EDF ${reasons.join(", ")}. Vui l\xF2ng g\u1EE1 kh\u1ECFi nh\u1EEFng ch\u1ED7 \u0111\xF3 tr\u01B0\u1EDBc.`,
          usage: {
            classSchedules: usedInClasses.length,
            staffShifts: usedInRoster.length,
            staffAttendance: usedInTimesheet.length
          }
        });
      }
      const result = await updateReturning(
        db,
        shifts,
        { isDeleted: true, deletedAt: /* @__PURE__ */ new Date() },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(shifts.id, shiftId), (0, import_drizzle_orm5.eq)(shifts.tenantId, tenantId), (0, import_drizzle_orm5.eq)(shifts.isDeleted, false))
      );
      if (result.length === 0) {
        return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ca l\xE0m vi\u1EC7c." });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete shift" });
    }
  });
  app.get("/api/classes", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      let query = db.select().from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false)));
      if (req.dbUser?.role === "teacher") {
        query = db.select().from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false), (0, import_drizzle_orm5.eq)(classes.teacherId, req.dbUser.id)));
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        query = db.select().from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId)));
      }
      const classesData = await query;
      const allEnrollments = await db.select({ classId: classEnrollments.classId }).from(classEnrollments).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classEnrollments.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classEnrollments.isDeleted, false)));
      const result = classesData.map((c) => {
        const studentCount = allEnrollments.filter((s) => s.classId === c.id).length;
        return { ...c, studentCount };
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch classes" });
    }
  });
  app.post("/api/classes", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      let { branchId, name, program, tuition, teacherId, sessionsPerMonth, feeMethod } = req.body;
      if (req.dbUser?.role !== "admin") {
        if (!req.dbUser?.branchId) {
          return res.status(403).json({ error: "You must be assigned to a branch to create classes." });
        }
        branchId = req.dbUser.branchId;
      }
      const result = await insertReturning(db, classes, {
        tenantId,
        branchId: parseInt(branchId),
        teacherId: teacherId ? parseInt(teacherId) : null,
        name,
        program,
        tuition: tuition ? parseInt(tuition) : null,
        sessionsPerMonth: sessionsPerMonth ? parseInt(sessionsPerMonth) : null,
        feeMethod: feeMethod || "per_session"
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create class" });
    }
  });
  app.put("/api/classes/:id", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { id } = req.params;
      let { branchId, name, program, tuition, teacherId, sessionsPerMonth, feeMethod } = req.body;
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.id, parseInt(id)), (0, import_drizzle_orm5.eq)(classes.isDeleted, false)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Forbidden: Cannot edit class in this branch" });
        }
        branchId = req.dbUser.branchId;
      }
      const result = await updateReturning(
        db,
        classes,
        {
          branchId: parseInt(branchId),
          teacherId: teacherId ? parseInt(teacherId) : null,
          name,
          program,
          tuition: tuition ? parseInt(tuition) : null,
          sessionsPerMonth: sessionsPerMonth ? parseInt(sessionsPerMonth) : null,
          feeMethod: feeMethod || "per_session"
        },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.id, parseInt(id)), (0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false))
      );
      res.json(result[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update class" });
    }
  });
  app.delete("/api/classes/:id", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { id } = req.params;
      const classId = parseInt(id);
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.id, classId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "Forbidden: Cannot delete class in this branch" });
        }
      }
      const classStudents = await db.select({ id: classEnrollments.id }).from(classEnrollments).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classEnrollments.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classEnrollments.classId, classId), (0, import_drizzle_orm5.eq)(classEnrollments.isDeleted, false))).limit(1);
      if (classStudents.length > 0) {
        return res.status(400).json({ error: "Kh\xF4ng th\u1EC3 x\xF3a l\u1EDBp h\u1ECDc v\xEC \u0111\xE3 c\xF3 h\u1ECDc vi\xEAn \u0111\u0103ng k\xFD." });
      }
      const result = await updateReturning(
        db,
        classes,
        { isDeleted: true, deletedAt: /* @__PURE__ */ new Date() },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.id, classId), (0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false))
      );
      res.json(result[0] || { success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete class" });
    }
  });
  app.get("/api/students", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { classId, startDate, endDate } = req.query;
      let allowedClassIds = null;
      if (req.dbUser?.role === "teacher") {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.teacherId, req.dbUser.id)));
        allowedClassIds = allowedClasses.map((c) => c.id);
        if (allowedClassIds.length === 0) {
          return res.json([]);
        }
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId)));
        allowedClassIds = allowedClasses.map((c) => c.id);
        if (allowedClassIds.length === 0) {
          return res.json([]);
        }
      }
      const conditions = [(0, import_drizzle_orm5.eq)(classEnrollments.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classEnrollments.isDeleted, false), (0, import_drizzle_orm5.eq)(students.isDeleted, false)];
      if (classId) {
        conditions.push((0, import_drizzle_orm5.eq)(classEnrollments.classId, parseInt(classId)));
      }
      if (allowedClassIds) {
        conditions.push((0, import_drizzle_orm5.inArray)(classEnrollments.classId, allowedClassIds));
      }
      const rawResult = await db.select({
        student: students,
        enrollment: classEnrollments
      }).from(classEnrollments).innerJoin(students, (0, import_drizzle_orm5.eq)(classEnrollments.studentId, students.id)).where((0, import_drizzle_orm5.and)(...conditions));
      const result = rawResult.map((row) => ({
        ...row.student,
        classId: row.enrollment.classId,
        tuitionStatus: row.enrollment.tuitionStatus,
        tuitionOwed: row.enrollment.tuitionOwed,
        tuitionFee: row.enrollment.tuitionFee,
        entryLevel: row.enrollment.entryLevel,
        enrollmentDate: row.enrollment.enrollmentDate,
        enrollmentId: row.enrollment.id
      }));
      let filterStartDate = /* @__PURE__ */ new Date();
      let filterEndDate = /* @__PURE__ */ new Date();
      if (startDate && endDate) {
        filterStartDate = new Date(startDate);
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate = new Date(endDate);
        filterEndDate.setHours(23, 59, 59, 999);
      } else {
        filterStartDate.setDate(1);
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate.setMonth(filterEndDate.getMonth() + 1);
        filterEndDate.setDate(0);
        filterEndDate.setHours(23, 59, 59, 999);
      }
      const studentIds = result.map((s) => s.id);
      let attendanceCounts = {};
      if (studentIds.length > 0) {
        const attendanceRecords = await db.select({
          studentId: attendance.studentId,
          count: import_drizzle_orm5.sql`count(${attendance.id})`.mapWith(Number)
        }).from(attendance).where(
          (0, import_drizzle_orm5.and)(
            (0, import_drizzle_orm5.eq)(attendance.tenantId, tenantId),
            (0, import_drizzle_orm5.eq)(attendance.isDeleted, false),
            (0, import_drizzle_orm5.inArray)(attendance.studentId, studentIds),
            (0, import_drizzle_orm5.eq)(attendance.status, "present"),
            (0, import_drizzle_orm5.gte)(attendance.date, filterStartDate),
            (0, import_drizzle_orm5.lte)(attendance.date, filterEndDate)
          )
        ).groupBy(attendance.studentId);
        attendanceRecords.forEach((record) => {
          if (record.studentId) attendanceCounts[record.studentId] = record.count;
        });
      }
      const mappedResult = result.map((student) => ({
        ...student,
        attendedSessionsCount: attendanceCounts[student.id] || 0
      }));
      res.json(mappedResult);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });
  app.get("/api/students/search", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (rawQuery.length < 2) {
        return res.json([]);
      }
      const pattern = `%${rawQuery}%`;
      const upperPattern = `%${rawQuery.toUpperCase()}%`;
      const result = await db.select({
        id: students.id,
        name: students.name,
        studentCode: students.studentCode,
        hanetPersonId: students.hanetPersonId
      }).from(students).where((0, import_drizzle_orm5.and)(
        (0, import_drizzle_orm5.eq)(students.tenantId, tenantId),
        (0, import_drizzle_orm5.eq)(students.isDeleted, false),
        (0, import_drizzle_orm5.or)(
          (0, import_drizzle_orm5.like)(students.name, pattern),
          (0, import_drizzle_orm5.like)(students.studentCode, pattern),
          (0, import_drizzle_orm5.like)(students.studentCode, upperPattern)
        )
      )).orderBy(students.name).limit(20);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to search students" });
    }
  });
  app.post("/api/students", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const {
        name,
        studentCode,
        phone,
        classId,
        tuitionStatus,
        tuitionOwed,
        dob,
        gender,
        entryLevel,
        enrollmentDate,
        tuitionFee,
        parentName,
        parentPhone,
        address,
        note
      } = req.body;
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
          return res.status(403).json({ error: "Forbidden: Cannot add student to this class" });
        }
      }
      let student = null;
      if (studentCode) {
        const existing = await db.select().from(students).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(students.tenantId, tenantId), (0, import_drizzle_orm5.eq)(students.studentCode, studentCode), (0, import_drizzle_orm5.eq)(students.isDeleted, false)));
        if (existing.length > 0) student = existing[0];
      }
      if (!student) {
        const insertRes = await insertReturning(db, students, {
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
        });
        student = insertRes ?? null;
      }
      if (!student) {
        return res.status(500).json({ error: "Failed to create student" });
      }
      const enrollmentRes = await insertReturning(db, classEnrollments, {
        tenantId,
        studentId: student.id,
        classId: parseInt(classId),
        tuitionStatus: req.dbUser?.role === "admin" || req.dbUser?.role === "manager" ? tuitionStatus || "Ch\u01B0a \u0111\xF3ng" : "Ch\u01B0a \u0111\xF3ng",
        tuitionOwed: tuitionStatus === "C\xF2n thi\u1EBFu" && tuitionOwed ? parseInt(tuitionOwed) : 0,
        tuitionFee: tuitionFee ? parseInt(tuitionFee) : null,
        entryLevel: entryLevel || null,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : null
      });
      res.json({ ...student, classId: enrollmentRes?.classId, tuitionStatus: enrollmentRes?.tuitionStatus, tuitionOwed: enrollmentRes?.tuitionOwed });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create student" });
    }
  });
  app.post("/api/students/bulk", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { classId, studentsData } = req.body;
      if (!classId || !studentsData || studentsData.length === 0) {
        return res.status(400).json({ error: "Invalid data" });
      }
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      const incomingCodes = studentsData.map((s) => s.studentCode).filter((code) => !!code);
      if (incomingCodes.length > 0) {
        const existingCodes = await db.select({ studentCode: students.studentCode }).from(students).where((0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(students.tenantId, tenantId),
          (0, import_drizzle_orm5.eq)(students.isDeleted, false),
          (0, import_drizzle_orm5.inArray)(students.studentCode, incomingCodes)
        ));
        if (existingCodes.length > 0) {
          return res.status(400).json({
            error: "M\u1ED9t s\u1ED1 m\xE3 h\u1ECDc vi\xEAn \u0111\xE3 t\u1ED3n t\u1EA1i trong h\u1EC7 th\u1ED1ng, vui l\xF2ng ki\u1EC3m tra l\u1EA1i file.",
            duplicateCodes: existingCodes.map((c) => c.studentCode)
          });
        }
        const seenCodes = /* @__PURE__ */ new Set();
        const duplicatesInFile = /* @__PURE__ */ new Set();
        for (const code of incomingCodes) {
          if (seenCodes.has(code)) {
            duplicatesInFile.add(code);
          }
          seenCodes.add(code);
        }
        if (duplicatesInFile.size > 0) {
          return res.status(400).json({
            error: "File c\xF3 m\xE3 h\u1ECDc vi\xEAn b\u1ECB tr\xF9ng l\u1EB7p, vui l\xF2ng ki\u1EC3m tra l\u1EA1i.",
            duplicateCodes: Array.from(duplicatesInFile)
          });
        }
      }
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        if (typeof dateStr === "number") {
          return new Date(Math.round((dateStr - 25569) * 86400 * 1e3));
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        if (typeof dateStr === "string") {
          const parts = dateStr.split(/[-/]/);
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const year = parseInt(parts[2]);
            const parsed = new Date(year, month, day);
            if (!isNaN(parsed.getTime())) return parsed;
          }
        }
        return null;
      };
      const parseMoney = (money) => {
        if (!money) return null;
        if (typeof money === "number") return money;
        const clean = String(money).replace(/\D/g, "");
        return clean ? parseInt(clean) : null;
      };
      const parsedClassId = parseInt(classId);
      const studentRows = studentsData.map((s) => ({
        tenantId,
        name: s.name,
        studentCode: s.studentCode || `HV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        phone: s.phone || null,
        dob: parseDate(s.dob),
        gender: s.gender || null,
        parentName: s.parentName || null,
        parentPhone: s.parentPhone || null,
        address: s.address || null,
        note: s.note || null
      }));
      const enrollmentByCode = /* @__PURE__ */ new Map();
      studentsData.forEach((s, idx) => {
        enrollmentByCode.set(studentRows[idx].studentCode, {
          entryLevel: s.entryLevel || null,
          enrollmentDate: parseDate(s.enrollmentDate),
          tuitionFee: parseMoney(s.tuitionFee)
        });
      });
      const insertedCodes = studentRows.map((v) => v.studentCode);
      const created = await db.transaction(async (tx) => {
        await tx.insert(students).values(studentRows);
        const insertedStudents = await tx.select().from(students).where((0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(students.tenantId, tenantId),
          (0, import_drizzle_orm5.eq)(students.isDeleted, false),
          (0, import_drizzle_orm5.inArray)(students.studentCode, insertedCodes)
        ));
        await tx.insert(classEnrollments).values(
          insertedStudents.map((st) => {
            const info = enrollmentByCode.get(st.studentCode);
            return {
              tenantId,
              studentId: st.id,
              classId: parsedClassId,
              tuitionStatus: "Ch\u01B0a \u0111\xF3ng",
              tuitionOwed: 0,
              tuitionFee: info?.tuitionFee ?? null,
              entryLevel: info?.entryLevel ?? null,
              enrollmentDate: info?.enrollmentDate ?? null
            };
          })
        );
        return insertedStudents.map((st) => {
          const info = enrollmentByCode.get(st.studentCode);
          return {
            ...st,
            classId: parsedClassId,
            tuitionStatus: "Ch\u01B0a \u0111\xF3ng",
            tuitionOwed: 0,
            tuitionFee: info?.tuitionFee ?? null,
            entryLevel: info?.entryLevel ?? null,
            enrollmentDate: info?.enrollmentDate ?? null
          };
        });
      });
      res.json(created);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Bulk insert failed" });
    }
  });
  app.put("/api/students/:id", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { id } = req.params;
      const { name, phone, classId, tuitionStatus, tuitionOwed } = req.body;
      const result = await updateReturning(
        db,
        students,
        { name, phone },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(students.id, parseInt(id)), (0, import_drizzle_orm5.eq)(students.tenantId, tenantId), (0, import_drizzle_orm5.eq)(students.isDeleted, false))
      );
      if (classId) {
        await db.update(classEnrollments).set({
          ...tuitionStatus && (req.dbUser?.role === "admin" || req.dbUser?.role === "manager") && { tuitionStatus },
          ...(req.dbUser?.role === "admin" || req.dbUser?.role === "manager") && { tuitionOwed: tuitionStatus === "C\xF2n thi\u1EBFu" && tuitionOwed ? parseInt(tuitionOwed) : 0 }
        }).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classEnrollments.studentId, parseInt(id)), (0, import_drizzle_orm5.eq)(classEnrollments.classId, parseInt(classId)), (0, import_drizzle_orm5.eq)(classEnrollments.isDeleted, false)));
      }
      res.json(result[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update student" });
    }
  });
  app.delete("/api/students/:id/hanet-link", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const studentId = parseInt(req.params.id);
      if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowed = await db.select({ id: classEnrollments.id }).from(classEnrollments).innerJoin(classes, (0, import_drizzle_orm5.eq)(classEnrollments.classId, classes.id)).where((0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(classEnrollments.studentId, studentId),
          (0, import_drizzle_orm5.eq)(classEnrollments.tenantId, tenantId),
          (0, import_drizzle_orm5.eq)(classEnrollments.isDeleted, false),
          (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId)
        )).limit(1);
        if (allowed.length === 0) {
          return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n thao t\xE1c v\u1EDBi h\u1ECDc vi\xEAn ngo\xE0i chi nh\xE1nh m\xECnh." });
        }
      }
      const result = await updateReturning(
        db,
        students,
        { hanetPersonId: null },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(students.id, studentId), (0, import_drizzle_orm5.eq)(students.tenantId, tenantId), (0, import_drizzle_orm5.eq)(students.isDeleted, false))
      );
      if (result.length === 0) {
        return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y h\u1ECDc vi\xEAn" });
      }
      res.json({ success: true, student: result[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to unlink Hanet face" });
    }
  });
  app.delete("/api/students/:id", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { id } = req.params;
      const studentId = parseInt(id);
      const { classId } = req.query;
      await db.transaction(async (tx) => {
        if (classId) {
          const parsedClassId = parseInt(classId);
          await tx.update(classEnrollments).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)(
            (0, import_drizzle_orm5.eq)(classEnrollments.studentId, studentId),
            (0, import_drizzle_orm5.eq)(classEnrollments.classId, parsedClassId),
            (0, import_drizzle_orm5.eq)(classEnrollments.tenantId, tenantId),
            (0, import_drizzle_orm5.eq)(classEnrollments.isDeleted, false)
          ));
          await tx.update(attendance).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)(
            (0, import_drizzle_orm5.eq)(attendance.studentId, studentId),
            (0, import_drizzle_orm5.eq)(attendance.classId, parsedClassId),
            (0, import_drizzle_orm5.eq)(attendance.tenantId, tenantId),
            (0, import_drizzle_orm5.eq)(attendance.isDeleted, false)
          ));
        } else {
          await tx.update(attendance).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(attendance.studentId, studentId), (0, import_drizzle_orm5.eq)(attendance.tenantId, tenantId), (0, import_drizzle_orm5.eq)(attendance.isDeleted, false)));
          await tx.update(classEnrollments).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classEnrollments.studentId, studentId), (0, import_drizzle_orm5.eq)(classEnrollments.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classEnrollments.isDeleted, false)));
          await tx.update(students).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(students.id, studentId), (0, import_drizzle_orm5.eq)(students.tenantId, tenantId), (0, import_drizzle_orm5.eq)(students.isDeleted, false)));
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete student" });
    }
  });
  app.get("/api/attendance", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { classId, date: date2 } = req.query;
      if (!classId || !date2) {
        return res.status(400).json({ error: "classId and date are required" });
      }
      if (req.dbUser?.role === "teacher") {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.teacherId, req.dbUser.id), (0, import_drizzle_orm5.eq)(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
          return res.status(403).json({ error: "Forbidden access to this class" });
        }
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
          return res.status(403).json({ error: "Forbidden access to this class" });
        }
      }
      const queryDate = new Date(date2);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
      const result = await db.select().from(attendance).where(
        (0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(attendance.tenantId, tenantId),
          (0, import_drizzle_orm5.eq)(attendance.isDeleted, false),
          (0, import_drizzle_orm5.eq)(attendance.classId, parseInt(classId)),
          (0, import_drizzle_orm5.gte)(attendance.date, startOfDay),
          (0, import_drizzle_orm5.lte)(attendance.date, endOfDay)
        )
      );
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });
  app.post("/api/attendance", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { studentId, classId, date: date2, status, homeworkCompleted, note } = req.body;
      if (req.dbUser?.role === "teacher") {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.teacherId, req.dbUser.id), (0, import_drizzle_orm5.eq)(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
          return res.status(403).json({ error: "Forbidden access to this class" });
        }
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.id, parseInt(classId))));
        if (allowedClasses.length === 0) {
          return res.status(403).json({ error: "Forbidden access to this class" });
        }
      }
      const queryDate = new Date(date2);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
      const result = await db.transaction(async (tx) => {
        await tx.update(attendance).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(attendance.tenantId, tenantId),
          (0, import_drizzle_orm5.eq)(attendance.studentId, parseInt(studentId)),
          (0, import_drizzle_orm5.eq)(attendance.classId, parseInt(classId)),
          (0, import_drizzle_orm5.eq)(attendance.isDeleted, false),
          (0, import_drizzle_orm5.gte)(attendance.date, startOfDay),
          (0, import_drizzle_orm5.lte)(attendance.date, endOfDay)
        ));
        return await insertReturning(tx, attendance, {
          tenantId,
          studentId: parseInt(studentId),
          classId: parseInt(classId),
          date: new Date(date2),
          status,
          homeworkCompleted: homeworkCompleted ? 1 : 0,
          note
        });
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to mark attendance" });
    }
  });
  app.get("/api/attendance-sessions", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { classId } = req.query;
      let allowedClassIds = null;
      if (req.dbUser?.role === "teacher") {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.teacherId, req.dbUser.id), (0, import_drizzle_orm5.eq)(classes.isDeleted, false)));
        allowedClassIds = allowedClasses.map((c) => c.id);
      } else if (req.dbUser?.role !== "admin" && req.dbUser?.branchId) {
        const allowedClasses = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false)));
        allowedClassIds = allowedClasses.map((c) => c.id);
      }
      if (allowedClassIds && allowedClassIds.length === 0) {
        return res.json([]);
      }
      const sessionExpiry = new Date(Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1e3);
      const conditions = [
        (0, import_drizzle_orm5.eq)(attendanceSessions.tenantId, tenantId),
        (0, import_drizzle_orm5.isNull)(attendanceSessions.closedAt),
        (0, import_drizzle_orm5.gte)(attendanceSessions.openedAt, sessionExpiry)
      ];
      if (classId) {
        conditions.push((0, import_drizzle_orm5.eq)(attendanceSessions.classId, parseInt(classId)));
      }
      if (allowedClassIds) {
        conditions.push((0, import_drizzle_orm5.inArray)(attendanceSessions.classId, allowedClassIds));
      }
      const result = await db.select().from(attendanceSessions).where((0, import_drizzle_orm5.and)(...conditions)).orderBy((0, import_drizzle_orm5.desc)(attendanceSessions.openedAt));
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch attendance sessions" });
    }
  });
  app.post("/api/attendance-sessions", requireAuth, async (req, res) => {
    try {
      if (!req.dbUser) {
        return res.status(403).json({ error: "Kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c ng\u01B0\u1EDDi d\xF9ng" });
      }
      const tenantId = req.dbUser.tenantId || req.user.uid;
      const { classId } = req.body;
      if (!classId || isNaN(parseInt(classId))) {
        return res.status(400).json({ error: "classId l\xE0 b\u1EAFt bu\u1ED9c" });
      }
      const parsedClassId = parseInt(classId);
      if (req.dbUser.role === "teacher") {
        const allowed = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.teacherId, req.dbUser.id), (0, import_drizzle_orm5.eq)(classes.id, parsedClassId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "B\u1EA1n kh\xF4ng ph\u1EE5 tr\xE1ch l\u1EDBp n\xE0y" });
        }
      } else if (req.dbUser.role !== "admin" && req.dbUser.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.id, parsedClassId), (0, import_drizzle_orm5.eq)(classes.isDeleted, false)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "L\u1EDBp n\xE0y kh\xF4ng thu\u1ED9c chi nh\xE1nh c\u1EE7a b\u1EA1n" });
        }
      }
      const sessionExpiry = new Date(Date.now() - HANET_SESSION_EXPIRY_HOURS * 60 * 60 * 1e3);
      const existingOpen = await db.select().from(attendanceSessions).where((0, import_drizzle_orm5.and)(
        (0, import_drizzle_orm5.eq)(attendanceSessions.classId, parsedClassId),
        (0, import_drizzle_orm5.eq)(attendanceSessions.tenantId, tenantId),
        (0, import_drizzle_orm5.isNull)(attendanceSessions.closedAt),
        (0, import_drizzle_orm5.gte)(attendanceSessions.openedAt, sessionExpiry)
      )).limit(1);
      if (existingOpen.length > 0) {
        return res.json(existingOpen[0]);
      }
      const result = await insertReturning(db, attendanceSessions, {
        tenantId,
        classId: parsedClassId,
        openedBy: req.dbUser.id
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to open attendance session" });
    }
  });
  app.put("/api/attendance-sessions/:id/close", requireAuth, async (req, res) => {
    try {
      if (!req.dbUser) {
        return res.status(403).json({ error: "Kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c ng\u01B0\u1EDDi d\xF9ng" });
      }
      const tenantId = req.dbUser.tenantId || req.user.uid;
      const sessionId = parseInt(req.params.id);
      const existing = await db.select().from(attendanceSessions).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(attendanceSessions.id, sessionId), (0, import_drizzle_orm5.eq)(attendanceSessions.tenantId, tenantId))).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn \u0111i\u1EC3m danh" });
      }
      const session = existing[0];
      if (req.dbUser.role === "teacher") {
        const allowed = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.id, session.classId), (0, import_drizzle_orm5.eq)(classes.teacherId, req.dbUser.id)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "B\u1EA1n kh\xF4ng ph\u1EE5 tr\xE1ch l\u1EDBp n\xE0y" });
        }
      } else if (req.dbUser.role !== "admin" && req.dbUser.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.id, session.classId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "L\u1EDBp n\xE0y kh\xF4ng thu\u1ED9c chi nh\xE1nh c\u1EE7a b\u1EA1n" });
        }
      }
      const result = await updateReturning(
        db,
        attendanceSessions,
        { closedAt: /* @__PURE__ */ new Date() },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(attendanceSessions.id, sessionId), (0, import_drizzle_orm5.eq)(attendanceSessions.tenantId, tenantId), (0, import_drizzle_orm5.isNull)(attendanceSessions.closedAt))
      );
      res.json(result[0] || session);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to close attendance session" });
    }
  });
  app.get("/api/hanet-pending-checkins", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const result = await db.select({
        id: hanetPendingCheckins.id,
        hanetRecordId: hanetPendingCheckins.hanetRecordId,
        hanetPersonId: hanetPendingCheckins.hanetPersonId,
        personName: hanetPendingCheckins.personName,
        studentId: hanetPendingCheckins.studentId,
        candidateClassIds: hanetPendingCheckins.candidateClassIds,
        checkinTime: hanetPendingCheckins.checkinTime,
        imageUrl: hanetPendingCheckins.imageUrl,
        reason: hanetPendingCheckins.reason,
        createdAt: hanetPendingCheckins.createdAt,
        studentName: students.name,
        studentCode: students.studentCode
      }).from(hanetPendingCheckins).leftJoin(students, (0, import_drizzle_orm5.eq)(hanetPendingCheckins.studentId, students.id)).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(hanetPendingCheckins.tenantId, tenantId), (0, import_drizzle_orm5.isNull)(hanetPendingCheckins.resolvedAt))).orderBy((0, import_drizzle_orm5.desc)(hanetPendingCheckins.checkinTime));
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch pending checkins" });
    }
  });
  app.put("/api/hanet-pending-checkins/:id/resolve", requireAuth, async (req, res) => {
    try {
      if (!req.dbUser) {
        return res.status(403).json({ error: "Kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c ng\u01B0\u1EDDi d\xF9ng" });
      }
      const tenantId = req.dbUser.tenantId || req.user.uid;
      const pendingId = parseInt(req.params.id);
      const { classId, studentId } = req.body;
      if (!classId || isNaN(parseInt(classId))) {
        return res.status(400).json({ error: "classId l\xE0 b\u1EAFt bu\u1ED9c" });
      }
      const parsedClassId = parseInt(classId);
      if (req.dbUser.role === "teacher") {
        const allowed = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.teacherId, req.dbUser.id), (0, import_drizzle_orm5.eq)(classes.id, parsedClassId)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "B\u1EA1n kh\xF4ng ph\u1EE5 tr\xE1ch l\u1EDBp n\xE0y" });
        }
      } else if (req.dbUser.role !== "admin" && req.dbUser.branchId) {
        const allowed = await db.select({ id: classes.id }).from(classes).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(classes.tenantId, tenantId), (0, import_drizzle_orm5.eq)(classes.branchId, req.dbUser.branchId), (0, import_drizzle_orm5.eq)(classes.id, parsedClassId)));
        if (allowed.length === 0) {
          return res.status(403).json({ error: "L\u1EDBp n\xE0y kh\xF4ng thu\u1ED9c chi nh\xE1nh c\u1EE7a b\u1EA1n" });
        }
      }
      const pendingRows = await db.select().from(hanetPendingCheckins).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(hanetPendingCheckins.id, pendingId), (0, import_drizzle_orm5.eq)(hanetPendingCheckins.tenantId, tenantId))).limit(1);
      if (pendingRows.length === 0) {
        return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y check-in n\xE0y" });
      }
      const pending = pendingRows[0];
      if (pending.resolvedAt) {
        return res.status(400).json({ error: "Check-in n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c x\u1EED l\xFD tr\u01B0\u1EDBc \u0111\xF3" });
      }
      let resolvedStudentId = pending.studentId;
      let studentIdToLink = null;
      if (!resolvedStudentId) {
        if (!studentId) {
          return res.status(400).json({ error: "C\u1EA7n ch\u1ECDn h\u1ECDc vi\xEAn \u0111\u1EC3 li\xEAn k\u1EBFt v\u1EDBi khu\xF4n m\u1EB7t Hanet n\xE0y" });
        }
        const targetStudent = await db.select().from(students).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(students.id, parseInt(studentId)), (0, import_drizzle_orm5.eq)(students.tenantId, tenantId), (0, import_drizzle_orm5.eq)(students.isDeleted, false))).limit(1);
        if (targetStudent.length === 0) {
          return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y h\u1ECDc vi\xEAn" });
        }
        const alreadyLinked = await db.select({
          id: students.id,
          name: students.name,
          studentCode: students.studentCode
        }).from(students).where((0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(students.hanetPersonId, pending.hanetPersonId),
          (0, import_drizzle_orm5.eq)(students.tenantId, tenantId),
          (0, import_drizzle_orm5.eq)(students.isDeleted, false)
        )).limit(1);
        if (alreadyLinked.length > 0 && alreadyLinked[0].id !== targetStudent[0].id) {
          return res.status(400).json({
            error: `Khu\xF4n m\u1EB7t n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c li\xEAn k\u1EBFt v\u1EDBi h\u1ECDc vi\xEAn ${alreadyLinked[0].name} (${alreadyLinked[0].studentCode}). N\u1EBFu li\xEAn k\u1EBFt \u0111\xF3 sai, h\xE3y g\u1EE1 li\xEAn k\u1EBFt c\u1EE7a h\u1ECDc vi\xEAn ${alreadyLinked[0].name} tr\u01B0\u1EDBc r\u1ED3i th\u1EED l\u1EA1i.`,
            conflictStudentId: alreadyLinked[0].id,
            conflictStudentName: alreadyLinked[0].name
          });
        }
        resolvedStudentId = targetStudent[0].id;
        studentIdToLink = targetStudent[0].id;
      }
      const finalStudentId = resolvedStudentId;
      const checkinTime = pending.checkinTime;
      const startOfDay = new Date(checkinTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(checkinTime);
      endOfDay.setHours(23, 59, 59, 999);
      await db.transaction(async (tx) => {
        if (studentIdToLink) {
          await tx.update(students).set({ hanetPersonId: pending.hanetPersonId }).where((0, import_drizzle_orm5.eq)(students.id, studentIdToLink));
        }
        await tx.update(attendance).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)(
          (0, import_drizzle_orm5.eq)(attendance.tenantId, tenantId),
          (0, import_drizzle_orm5.eq)(attendance.studentId, finalStudentId),
          (0, import_drizzle_orm5.eq)(attendance.classId, parsedClassId),
          (0, import_drizzle_orm5.eq)(attendance.isDeleted, false),
          (0, import_drizzle_orm5.gte)(attendance.date, startOfDay),
          (0, import_drizzle_orm5.lte)(attendance.date, endOfDay)
        ));
        await tx.insert(attendance).values({
          tenantId,
          studentId: finalStudentId,
          classId: parsedClassId,
          date: checkinTime,
          status: "present",
          note: "\u0110i\u1EC3m danh qua camera Hanet (nh\xE2n vi\xEAn x\xE1c nh\u1EADn l\u1EDBp th\u1EE7 c\xF4ng)"
        });
        await tx.update(hanetPendingCheckins).set({
          resolvedAt: /* @__PURE__ */ new Date(),
          resolvedClassId: parsedClassId,
          resolvedBy: req.dbUser.id,
          studentId: finalStudentId
        }).where((0, import_drizzle_orm5.eq)(hanetPendingCheckins.id, pendingId));
      });
      res.json({ success: true });
    } catch (error) {
      const message = typeof error?.message === "string" ? error.message : "";
      const isDuplicateKey = error?.code === "ER_DUP_ENTRY" || error?.errno === 1062 || message.includes("Duplicate entry");
      if (isDuplicateKey) {
        return res.status(400).json({
          error: "Khu\xF4n m\u1EB7t n\xE0y v\u1EEBa \u0111\u01B0\u1EE3c li\xEAn k\u1EBFt v\u1EDBi m\u1ED9t h\u1ECDc vi\xEAn kh\xE1c. Vui l\xF2ng t\u1EA3i l\u1EA1i trang v\xE0 ki\u1EC3m tra l\u1EA1i."
        });
      }
      console.error(error);
      res.status(500).json({ error: "Failed to resolve pending checkin" });
    }
  });
  app.put("/api/hanet-pending-checkins/:id/dismiss", requireAuth, async (req, res) => {
    try {
      if (!req.dbUser) {
        return res.status(403).json({ error: "Kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c ng\u01B0\u1EDDi d\xF9ng" });
      }
      const tenantId = req.dbUser.tenantId || req.user.uid;
      const pendingId = parseInt(req.params.id);
      const [dismissResult] = await db.update(hanetPendingCheckins).set({ resolvedAt: /* @__PURE__ */ new Date(), resolvedBy: req.dbUser.id }).where((0, import_drizzle_orm5.and)(
        (0, import_drizzle_orm5.eq)(hanetPendingCheckins.id, pendingId),
        (0, import_drizzle_orm5.eq)(hanetPendingCheckins.tenantId, tenantId),
        (0, import_drizzle_orm5.isNull)(hanetPendingCheckins.resolvedAt)
      ));
      if (dismissResult.affectedRows === 0) {
        return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ho\u1EB7c \u0111\xE3 \u0111\u01B0\u1EE3c x\u1EED l\xFD tr\u01B0\u1EDBc \u0111\xF3" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to dismiss pending checkin" });
    }
  });
  app.get("/api/inventory", (req, res) => {
    res.json({
      items: [
        { id: "HH01", name: "Gi\xE1o tr\xECnh Ti\u1EBFng Anh c\u01A1 b\u1EA3n", stock: 150, branch: "C\u01A1 s\u1EDF 1" },
        { id: "HH02", name: "M\xE1y chi\u1EBFu", stock: 5, branch: "C\u01A1 s\u1EDF 1" },
        { id: "HH03", name: "B\xFAt l\xF4ng", stock: 200, branch: "C\u01A1 s\u1EDF 2" }
      ]
    });
  });
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { branchId, type, category, startDate, endDate } = req.query;
      let conditions = [(0, import_drizzle_orm5.eq)(transactions.tenantId, tenantId), (0, import_drizzle_orm5.eq)(transactions.isDeleted, false)];
      if (branchId) conditions.push((0, import_drizzle_orm5.eq)(transactions.branchId, parseInt(branchId)));
      if (type) conditions.push((0, import_drizzle_orm5.eq)(transactions.type, type));
      if (category) conditions.push((0, import_drizzle_orm5.eq)(transactions.category, category));
      if (startDate && endDate) {
        conditions.push((0, import_drizzle_orm5.gte)(transactions.date, new Date(startDate)));
        conditions.push((0, import_drizzle_orm5.lte)(transactions.date, new Date(endDate)));
      }
      const data = await db.select({
        id: transactions.id,
        type: transactions.type,
        category: transactions.category,
        amount: transactions.amount,
        date: transactions.date,
        note: transactions.note,
        studentId: transactions.studentId,
        studentName: students.name
      }).from(transactions).leftJoin(students, (0, import_drizzle_orm5.eq)(transactions.studentId, students.id)).where((0, import_drizzle_orm5.and)(...conditions)).orderBy((0, import_drizzle_orm5.desc)(transactions.date));
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  app.post("/api/transactions", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      let { branchId, type, category, amount, date: date2, note, studentId } = req.body;
      if (req.dbUser?.role !== "admin") {
        if (!req.dbUser?.branchId) {
          return res.status(403).json({ error: "You must be assigned to a branch to create transactions." });
        }
        branchId = req.dbUser.branchId;
      }
      const result = await insertReturning(db, transactions, {
        tenantId,
        branchId: branchId ? parseInt(branchId) : null,
        type,
        category,
        amount: parseInt(amount),
        date: date2 ? new Date(date2) : /* @__PURE__ */ new Date(),
        note,
        studentId: studentId ? parseInt(studentId) : null
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });
  app.delete("/api/transactions/:id", requireAuth, requireRole(["admin", "manager", "staff"]), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const result = await updateReturning(
        db,
        transactions,
        { isDeleted: true, deletedAt: /* @__PURE__ */ new Date() },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(transactions.id, parseInt(req.params.id)), (0, import_drizzle_orm5.eq)(transactions.tenantId, tenantId), (0, import_drizzle_orm5.eq)(transactions.isDeleted, false))
      );
      res.json(result[0] || { success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });
  app.get("/api/promotions", requireAuth, async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const result = await db.select().from(promotions).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(promotions.tenantId, tenantId), (0, import_drizzle_orm5.eq)(promotions.isDeleted, false))).orderBy((0, import_drizzle_orm5.desc)(promotions.createdAt));
      res.json(result);
    } catch (error) {
      console.error("L\u1ED7i l\u1EA5y danh s\xE1ch \u01B0u \u0111\xE3i:", error);
      res.status(500).json({ error: "L\u1ED7i m\xE1y ch\u1EE7" });
    }
  });
  app.post("/api/promotions", requireAuth, requirePermission("/promotions"), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const { name, discountType, discountValue, branchIds, startDate, endDate, isActive } = req.body;
      if (discountType === "percentage" && discountValue > 100) {
        return res.status(400).json({ error: "Ph\u1EA7n tr\u0103m gi\u1EA3m gi\xE1 kh\xF4ng \u0111\u01B0\u1EE3c v\u01B0\u1EE3t qu\xE1 100" });
      }
      const newPromo = await insertReturning(db, promotions, {
        tenantId,
        name,
        discountType,
        discountValue,
        branchIds,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== void 0 ? isActive : true
      });
      res.json(newPromo);
    } catch (error) {
      console.error("L\u1ED7i t\u1EA1o \u01B0u \u0111\xE3i:", error);
      res.status(500).json({ error: "L\u1ED7i m\xE1y ch\u1EE7" });
    }
  });
  app.put("/api/promotions/:id", requireAuth, requirePermission("/promotions"), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const promoId = parseInt(req.params.id);
      const { name, discountType, discountValue, branchIds, startDate, endDate, isActive } = req.body;
      if (discountType === "percentage" && discountValue > 100) {
        return res.status(400).json({ error: "Ph\u1EA7n tr\u0103m gi\u1EA3m gi\xE1 kh\xF4ng \u0111\u01B0\u1EE3c v\u01B0\u1EE3t qu\xE1 100" });
      }
      const [updatedPromo] = await updateReturning(
        db,
        promotions,
        {
          name,
          discountType,
          discountValue,
          branchIds,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          isActive,
          updatedAt: /* @__PURE__ */ new Date()
        },
        (0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(promotions.id, promoId), (0, import_drizzle_orm5.eq)(promotions.tenantId, tenantId), (0, import_drizzle_orm5.eq)(promotions.isDeleted, false))
      );
      if (!updatedPromo) {
        return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u01B0u \u0111\xE3i" });
      }
      res.json(updatedPromo);
    } catch (error) {
      console.error("L\u1ED7i c\u1EADp nh\u1EADt \u01B0u \u0111\xE3i:", error);
      res.status(500).json({ error: "L\u1ED7i m\xE1y ch\u1EE7" });
    }
  });
  app.delete("/api/promotions/:id", requireAuth, requirePermission("/promotions"), async (req, res) => {
    try {
      const tenantId = req.dbUser?.tenantId || req.user.uid;
      const promoId = parseInt(req.params.id);
      await db.update(promotions).set({ isDeleted: true, deletedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(promotions.id, promoId), (0, import_drizzle_orm5.eq)(promotions.tenantId, tenantId), (0, import_drizzle_orm5.eq)(promotions.isDeleted, false)));
      res.json({ success: true });
    } catch (error) {
      console.error("L\u1ED7i x\xF3a \u01B0u \u0111\xE3i:", error);
      res.status(500).json({ error: "L\u1ED7i m\xE1y ch\u1EE7" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
