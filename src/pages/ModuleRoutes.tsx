/**
 * ModuleRoutes — Định nghĩa 5 trang module route.
 *
 * Mỗi component export tương ứng với một module chính trong hệ thống:
 *   SetupModule          → /setup         (blue)
 *   OperationsModule     → /operations    (indigo)
 *   CustomerCareModule   → /customer-care (emerald)
 *   AccountingModule     → /accounting    (amber)
 *   DirectorModule       → /director      (rose)
 *
 * Mỗi component render <ModulePage> với danh sách features cụ thể,
 * bao gồm tính năng đã triển khai (available: true) và sắp ra mắt
 * (available: false → hiện badge "Sắp ra mắt", click bị vô hiệu hóa).
 *
 * Feature counts phải khớp với Dashboard.tsx MODULE_CARDS:
 *   Thiết lập:    10 features (5 active)
 *   Vận hành:      6 features (4 active)
 *   CSKH:          5 features (0 active)
 *   Kế toán–NS:    8 features (7 active)
 *   Giám đốc TT:   5 features (0 active)
 *
 * RBAC: ModulePage tự xử lý lọc theo quyền — xem ModulePage.tsx.
 * ProtectedRoute KHÔNG kiểm tra module routes (trừ /customer-care
 * vì nó nằm trong navigation array) — ModulePage hiển thị empty
 * state khi user không có quyền truy cập feature nào.
 */

import {
  /* ── Icons tái sử dụng cho module headers ── */
  Settings,
  GraduationCap,
  MessageCircle,
  Wallet,
  BarChart3,

  /* ── Icons cho features đã triển khai ── */
  Camera,
  Clock,
  Percent,
  Users,
  CalendarDays,
  ClipboardCheck,
  Inbox,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Box,

  /* ── Icons cho features sắp ra mắt ── */
  Building2,
  BookOpen,
  BookMarked,
  Bell,
  Shield,
  Palette,
  FileSpreadsheet,
  Award,
  UserPlus,
  Star,
  Gift,
  Send,
  Banknote,
  FileText,
  TrendingUp,
  PieChart,
  Target,
  Download,
} from "lucide-react";
import { ModulePage } from "../components/ModulePage";
import type { ModuleFeature } from "../components/ModulePage";

/* ══════════════════════════════════════════════════════════
   1. Thiết lập — /setup — blue
   Tổng: 10 features · Active: 5
   (Đã chuyển "Quản lý ca học" sang Kế toán–NS, thêm "Camera")
   ══════════════════════════════════════════════════════════ */

const SETUP_FEATURES: ModuleFeature[] = [
  /* ── Đã triển khai ── */
  {
    name: "Quản lý cơ sở",
    description: "Cấu hình thông tin cơ sở, logo, liên hệ",
    href: "/settings",
    icon: Settings,
    available: true,
    roles: ["admin"],
  },
  {
    name: "Quản lý ưu đãi",
    description: "Thiết lập chương trình giảm giá, khuyến mãi",
    href: "/promotions",
    icon: Percent,
    available: true,
    roles: ["admin"],
  },
  {
    name: "Quản lý lớp học",
    description: "Tạo lớp, phân bổ giáo viên, cấu hình sĩ số",
    href: "/classes",
    icon: GraduationCap,
    available: true,
    roles: ["admin", "manager", "staff", "teacher"],
  },
  /* ── Sắp ra mắt ── */
  {
    name: "Quản lý phòng học",
    description: "Quản lý phòng học, trang thiết bị, sức chứa",
    href: "/settings/rooms",
    icon: Building2,
    available: false,
    roles: ["admin"],
  },
  {
    name: "Quản lý giáo trình",
    description: "Tổ chức giáo trình, tài liệu giảng dạy",
    href: "/settings/curriculum",
    icon: BookOpen,
    available: false,
    roles: ["admin", "manager"],
  },
  {
    name: "Quản lý khóa học",
    description: "Thiết lập khóa học, học phí, thời lượng",
    href: "/settings/courses",
    icon: BookMarked,
    available: false,
    roles: ["admin", "manager"],
  },
  {
    name: "Cài đặt thông báo",
    description: "Cấu hình thông báo tự động cho phụ huynh, học viên",
    href: "/settings/notifications",
    icon: Bell,
    available: false,
    roles: ["admin"],
  },
  {
    name: "Phân quyền nâng cao",
    description: "Tùy chỉnh quyền truy cập chi tiết cho từng vai trò",
    href: "/settings/permissions",
    icon: Shield,
    available: false,
    roles: ["admin"],
  },
  {
    name: "Tùy chỉnh giao diện",
    description: "Thay đổi tên, logo và giao diện hiển thị của trung tâm",
    href: "/settings/appearance",
    icon: Palette,
    available: true,
    roles: ["admin"],
  },
  {
    name: "Camera",
    description: "Cấu hình kết nối camera Hanet AI để điểm danh tự động",
    href: "/settings/camera",
    icon: Camera,
    available: true,
    roles: ["admin"],
  },
];

export function SetupModule() {
  return (
    <ModulePage
      title="Thiết lập"
      description="Khởi tạo & cấu hình cơ sở, ca học, lớp học, ưu đãi"
      icon={Settings}
      accentColor="blue"
      features={SETUP_FEATURES}
    />
  );
}

/* ══════════════════════════════════════════════════════════
   2. Vận hành lớp học — /operations — indigo
   Tổng: 6 features · Active: 4
   ══════════════════════════════════════════════════════════ */

const OPERATIONS_FEATURES: ModuleFeature[] = [
  /* ── Đã triển khai ── */
  {
    name: "Quản lý học viên",
    description: "Hồ sơ, nhập học, chuyển lớp, nghỉ học",
    href: "/students",
    icon: Users,
    available: true,
    roles: ["admin", "manager", "staff", "teacher"],
  },
  {
    name: "Thời khóa biểu",
    description: "Xem và quản lý lịch học theo tuần, tháng",
    href: "/schedule",
    icon: CalendarDays,
    available: true,
    roles: ["admin", "manager", "staff", "teacher"],
  },
  {
    name: "Điểm danh",
    description: "Điểm danh lớp học, theo dõi chuyên cần",
    href: "/attendance",
    icon: ClipboardCheck,
    available: true,
    roles: ["admin", "manager", "staff", "teacher"],
  },
  {
    name: "Check-in chờ xử lý",
    description: "Xử lý check-in từ camera Hanet AI",
    href: "/hanet-checkins",
    icon: Inbox,
    available: true,
    roles: ["admin", "manager", "staff", "teacher"],
  },
  /* ── Sắp ra mắt ── */
  {
    name: "Quản lý điểm số",
    description: "Nhập điểm, thống kê kết quả học tập",
    href: "/grades",
    icon: FileSpreadsheet,
    available: false,
    roles: ["admin", "manager", "teacher"],
  },
  {
    name: "Cấp chứng chỉ",
    description: "Tạo và quản lý chứng chỉ hoàn thành khóa học",
    href: "/certificates",
    icon: Award,
    available: false,
    roles: ["admin", "manager"],
  },
];

export function OperationsModule() {
  return (
    <ModulePage
      title="Vận hành lớp học"
      description="Quản lý học viên, thời khóa biểu, điểm danh, check-in"
      icon={GraduationCap}
      accentColor="indigo"
      features={OPERATIONS_FEATURES}
    />
  );
}

/* ══════════════════════════════════════════════════════════
   3. Chăm sóc khách hàng — /customer-care — emerald
   Tổng: 5 features · Active: 0
   ══════════════════════════════════════════════════════════ */

const CUSTOMER_CARE_FEATURES: ModuleFeature[] = [
  {
    name: "Tư vấn qua Zalo",
    description: "Gửi tin nhắn tư vấn, chăm sóc qua Zalo OA",
    href: "/customer-care/zalo",
    icon: MessageCircle,
    available: false,
    roles: ["admin", "manager", "staff"],
  },
  {
    name: "Quản lý tuyển sinh",
    description: "Theo dõi leads, phân công tư vấn viên",
    href: "/customer-care/enrollment",
    icon: UserPlus,
    available: false,
    roles: ["admin", "manager", "staff"],
  },
  {
    name: "Phản hồi & đánh giá",
    description: "Thu thập đánh giá từ phụ huynh, học viên",
    href: "/customer-care/feedback",
    icon: Star,
    available: false,
    roles: ["admin", "manager", "staff"],
  },
  {
    name: "Chương trình giới thiệu",
    description: "Quản lý chương trình giới thiệu bạn bè",
    href: "/customer-care/referral",
    icon: Gift,
    available: false,
    roles: ["admin", "manager"],
  },
  {
    name: "Tin nhắn hàng loạt",
    description: "Gửi thông báo, nhắc nhở đến nhóm học viên",
    href: "/customer-care/broadcast",
    icon: Send,
    available: false,
    roles: ["admin", "manager"],
  },
];

export function CustomerCareModule() {
  return (
    <ModulePage
      title="Chăm sóc khách hàng"
      description="Tư vấn, chăm sóc & giữ chân học viên qua Zalo, tin nhắn"
      icon={MessageCircle}
      accentColor="emerald"
      features={CUSTOMER_CARE_FEATURES}
    />
  );
}

/* ══════════════════════════════════════════════════════════
   4. Kế toán – Nhân sự — /accounting — amber
   Tổng: 8 features · Active: 6
   (Đã nhận "Ca làm việc" từ Thiết lập)
   ══════════════════════════════════════════════════════════ */

const ACCOUNTING_FEATURES: ModuleFeature[] = [
  /* ── Đã triển khai ── */
  {
    name: "Ca làm việc",
    description: "Tạo và quản lý các ca làm việc trong ngày",
    href: "/shifts",
    icon: Clock,
    available: true,
    roles: ["admin", "manager", "staff", "teacher"],
  },
  {
    name: "Quản lý thu chi",
    description: "Ghi nhận thu chi, theo dõi công nợ học phí",
    href: "/finance",
    icon: Wallet,
    available: true,
    roles: ["admin", "manager", "staff"],
  },
  {
    name: "Quản lý nhân viên",
    description: "Hồ sơ nhân viên, phân quyền, quản lý tài khoản",
    href: "/hr",
    icon: Briefcase,
    available: true,
    roles: ["admin"],
  },
  {
    name: "Xếp ca",
    description: "Phân ca làm việc cho nhân viên, giáo viên",
    href: "/staff-shifts",
    icon: CalendarClock,
    available: true,
    roles: ["admin", "manager", "staff", "teacher"],
  },
  {
    name: "Bảng công",
    description: "Theo dõi công, chấm công hàng ngày",
    href: "/staff-attendance",
    icon: ClipboardList,
    available: true,
    roles: ["admin", "manager", "staff", "teacher"],
  },
  {
    name: "Quản lý kho",
    description: "Nhập xuất kho, kiểm kê hàng hóa, vật tư",
    href: "/inventory",
    icon: Box,
    available: true,
    roles: ["admin", "manager"],
  },
  /* ── Sắp ra mắt ── */
  {
    name: "Bảng lương",
    description: "Quản lý các loại lương: cố định, %, theo ca, theo giờ",
    href: "/payroll",
    icon: Banknote,
    available: true,
    roles: ["admin"],
  },
  {
    name: "Hợp đồng lao động",
    description: "Quản lý hợp đồng, gia hạn, chấm dứt",
    href: "/contracts",
    icon: FileText,
    available: false,
    roles: ["admin"],
  },
];

export function AccountingModule() {
  return (
    <ModulePage
      title="Kế toán – Nhân sự"
      description="Thu chi, kho hàng, quản lý nhân viên, xếp ca & bảng công"
      icon={Wallet}
      accentColor="amber"
      features={ACCOUNTING_FEATURES}
    />
  );
}

/* ══════════════════════════════════════════════════════════
   5. Giám đốc trung tâm — /director — rose
   Tổng: 5 features · Active: 0
   ══════════════════════════════════════════════════════════ */

const DIRECTOR_FEATURES: ModuleFeature[] = [
  {
    name: "Báo cáo tổng hợp",
    description: "Tổng quan doanh thu, học viên, chi phí",
    href: "/reports",
    icon: BarChart3,
    available: false,
    roles: ["admin", "manager"],
  },
  {
    name: "Phân tích doanh thu",
    description: "Biểu đồ xu hướng, so sánh theo kỳ",
    href: "/reports/revenue",
    icon: TrendingUp,
    available: false,
    roles: ["admin", "manager"],
  },
  {
    name: "Phân tích học viên",
    description: "Tỷ lệ duy trì, tốc độ tăng trưởng",
    href: "/reports/students",
    icon: PieChart,
    available: false,
    roles: ["admin", "manager"],
  },
  {
    name: "KPI nhân viên",
    description: "Đánh giá hiệu suất, đo lường năng suất",
    href: "/reports/kpi",
    icon: Target,
    available: false,
    roles: ["admin"],
  },
  {
    name: "Xuất báo cáo",
    description: "Xuất file Excel, PDF cho ban giám đốc",
    href: "/reports/export",
    icon: Download,
    available: false,
    roles: ["admin", "manager"],
  },
];

export function DirectorModule() {
  return (
    <ModulePage
      title="Giám đốc trung tâm"
      description="Báo cáo tổng hợp, phân tích dữ liệu & ra quyết định"
      icon={BarChart3}
      accentColor="rose"
      features={DIRECTOR_FEATURES}
    />
  );
}
