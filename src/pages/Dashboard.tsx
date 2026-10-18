/**
 * Dashboard — Module Hub
 *
 * Trang chủ hiển thị 5 module lớn dạng card grid.
 * Click vào card → chuyển đến trang module (dùng ModulePage.tsx).
 *
 * Hiệu ứng:
 * - Header: fade-in + slide-down
 * - Cards: staggered fade-in từ dưới lên (delay 100ms/card)
 * - Hover: scale(1.02) + translate-y(-4px) + shadow-xl
 * - Click: scale(0.98) press effect
 * - Gradient bar trên mỗi card theo màu module
 *
 * RBAC:
 * - admin: thấy tất cả module
 * - Có permissions: thấy module nếu có ≥1 route con trong permissions
 * - Không permissions: fallback theo roles
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  GraduationCap,
  MessageCircle,
  Wallet,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import type { AccentColor } from "../components/ModulePage";

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface ModuleCardConfig {
  /** Tên module hiển thị trên card */
  title: string;
  /** Mô tả ngắn bên dưới tiêu đề */
  description: string;
  /** Icon đại diện module */
  icon: LucideIcon;
  /** Màu chủ đạo — quyết định gradient bar, icon color */
  accentColor: AccentColor;
  /** Route khi click vào card — VD: "/setup" */
  route: string;
  /** Roles được phép thấy module này (fallback khi không có permissions) */
  roles: string[];
  /** Danh sách route con thuộc module — dùng kiểm tra permission-based access */
  memberRoutes: string[];
  /** Tổng số tính năng trong module */
  featureCount: number;
  /** Số tính năng đã triển khai */
  activeCount: number;
}

/* ══════════════════════════════════════════════════════════
   Tailwind JIT-safe color map
   ══════════════════════════════════════════════════════════ */

const MODULE_STYLES: Record<
  AccentColor,
  { iconBg: string; iconText: string; gradient: string }
> = {
  blue: {
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    gradient: "from-blue-500 to-blue-600",
  },
  indigo: {
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-600",
    gradient: "from-indigo-500 to-indigo-600",
  },
  emerald: {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    gradient: "from-emerald-500 to-emerald-600",
  },
  amber: {
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    gradient: "from-amber-500 to-amber-600",
  },
  rose: {
    iconBg: "bg-rose-100",
    iconText: "text-rose-600",
    gradient: "from-rose-500 to-rose-600",
  },
};

/* ══════════════════════════════════════════════════════════
   Module definitions
   ══════════════════════════════════════════════════════════ */

const MODULE_CARDS: ModuleCardConfig[] = [
  {
    title: "Thiết lập",
    description: "Khởi tạo & cài đặt cơ sở, ca học, lớp học, ưu đãi",
    icon: Settings,
    accentColor: "blue",
    route: "/setup",
    roles: ["admin", "manager", "staff", "teacher"],
    memberRoutes: ["/settings", "/promotions", "/classes", "/settings/appearance", "/settings/camera"],
    featureCount: 10,
    activeCount: 5,
  },
  {
    title: "Vận hành lớp học",
    description: "Quản lý học viên, thời khóa biểu, điểm danh, check-in",
    icon: GraduationCap,
    accentColor: "indigo",
    route: "/operations",
    roles: ["admin", "manager", "staff", "teacher"],
    memberRoutes: ["/students", "/schedule", "/attendance", "/hanet-checkins"],
    featureCount: 6,
    activeCount: 4,
  },
  {
    title: "Chăm sóc khách hàng",
    description: "Tư vấn, chăm sóc & giữ chân học viên qua Zalo, tin nhắn",
    icon: MessageCircle,
    accentColor: "emerald",
    route: "/customer-care",
    roles: ["admin", "manager", "staff"],
    memberRoutes: [],
    featureCount: 5,
    activeCount: 0,
  },
  {
    title: "Kế toán – Nhân sự",
    description: "Thu chi, kho hàng, quản lý nhân viên, xếp ca & bảng công",
    icon: Wallet,
    accentColor: "amber",
    route: "/accounting",
    roles: ["admin", "manager", "staff", "teacher"],
    memberRoutes: [
      "/shifts",
      "/finance",
      "/hr",
      "/staff-shifts",
      "/staff-attendance",
      "/inventory",
    ],
    featureCount: 8,
    activeCount: 6,
  },
  {
    title: "Giám đốc trung tâm",
    description: "Báo cáo tổng hợp, phân tích dữ liệu & ra quyết định",
    icon: BarChart3,
    accentColor: "rose",
    route: "/director",
    roles: ["admin", "manager"],
    memberRoutes: [],
    featureCount: 5,
    activeCount: 0,
  },
];

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/* ══════════════════════════════════════════════════════════
   CSS keyframes
   ══════════════════════════════════════════════════════════ */

const KEYFRAMES = `
@keyframes dashboardHeaderEnter {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.dashboard-header-animate {
  opacity: 0;
  animation: dashboardHeaderEnter 0.4s ease-out forwards;
}

@keyframes dashboardCardEnter {
  from { opacity: 0; transform: translateY(24px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.dashboard-card-animate {
  opacity: 0;
  animation: dashboardCardEnter 0.45s ease-out forwards;
}
`;

/* ══════════════════════════════════════════════════════════
   Dashboard (Module Hub)
   ══════════════════════════════════════════════════════════ */

export function Dashboard() {
  const navigate = useNavigate();
  const { dbUser } = useAuth();

  const userRole = dbUser?.role || "staff";
  const displayName = dbUser?.name || "";

  /**
   * Lọc module theo quyền — cùng pattern với Sidebar/App:
   * 1. admin → thấy tất cả
   * 2. Có permissions → thấy module nếu ít nhất 1 route con nằm trong permissions
   * 3. Không permissions → fallback theo roles của module
   */
  const visibleModules = useMemo(() => {
    return MODULE_CARDS.filter((mod) => {
      if (userRole === "admin") return true;
      if (dbUser?.permissions) {
        return mod.memberRoutes.some((route) =>
          dbUser.permissions.includes(route),
        );
      }
      return mod.roles.includes(userRole);
    });
  }, [userRole, dbUser?.permissions]);

  const greeting = displayName
    ? `${getGreeting()}, ${displayName}!`
    : `${getGreeting()}!`;

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div className="space-y-8">
        {/* ── Header ── */}
        <div className="dashboard-header-animate">
          <h2 className="text-2xl font-bold text-slate-900">{greeting}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Chọn module để bắt đầu làm việc
          </p>
        </div>

        {/* ── Module grid ── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((mod, index) => (
            <ModuleHubCard
              key={mod.route}
              config={mod}
              index={index}
              onNavigate={navigate}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   ModuleHubCard (component nội bộ)
   ══════════════════════════════════════════════════════════ */

interface ModuleHubCardProps {
  config: ModuleCardConfig;
  /** Thứ tự card — quyết định animation-delay */
  index: number;
  onNavigate: (path: string) => void;
}

function ModuleHubCard({ config, index, onNavigate }: ModuleHubCardProps) {
  const {
    title,
    description,
    icon: ModuleIcon,
    accentColor,
    route,
    featureCount,
    activeCount,
  } = config;

  const style = MODULE_STYLES[accentColor];

  const handleClick = () => {
    onNavigate(route);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "dashboard-card-animate",
        "group relative overflow-hidden rounded-2xl bg-white p-6 text-left",
        "shadow-sm ring-1 ring-slate-200",
        "transition-all duration-300",
        "hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1",
        "active:scale-[0.98]",
        "cursor-pointer",
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Gradient accent bar — thanh màu trên cùng */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          style.gradient,
        )}
      />

      {/* Icon */}
      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
          style.iconBg,
        )}
      >
        <ModuleIcon className={cn("h-7 w-7", style.iconText)} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-slate-700">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        {description}
      </p>

      {/* Footer: feature count + chevron */}
      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">
          {activeCount}/{featureCount} tính năng
        </span>
        <ChevronRight className="h-4 w-4 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
    </button>
  );
}
