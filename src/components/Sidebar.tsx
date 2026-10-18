/**
 * Sidebar — Navigation phân nhóm theo module + accordion.
 *
 * Thay đổi so với phiên bản cũ:
 * - Navigation items nhóm vào 5 module sections
 * - Accordion expand/collapse cho mỗi nhóm (CSS grid transition)
 * - Auto-expand nhóm chứa route hiện tại
 * - Dot màu đại diện mỗi module
 * - Dashboard luôn ở top-level
 *
 * GIỮ NGUYÊN (backward-compatible):
 * - Export `navigation` flat array cho App.tsx permission check
 * - Logo/tên trung tâm (click → SettingsModal cho admin)
 * - User info + logout
 * - Dark theme bg-[#1e293b]
 * - RBAC filtering logic (admin/permissions/roles)
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Settings,
  Users,
  GraduationCap,
  MessageCircle,
  Wallet,
  Briefcase,
  Box,
  BarChart3,
  ClipboardCheck,
  CalendarDays,
  Inbox,
  Percent,
  Clock,
  CalendarClock,
  ClipboardList,
  ChevronDown,
  Palette,
  Camera,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import type { AccentColor } from "./ModulePage";

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

interface NavGroup {
  /** Tên hiển thị của module group */
  title: string;
  /** Icon đại diện */
  icon: LucideIcon;
  /** Màu chủ đạo — hiện dạng dot bên cạnh title */
  accentColor: AccentColor;
  /** Route của module page — VD: "/setup" (dùng làm key + auto-expand check) */
  route: string;
  /** Danh sách nav items thuộc module này */
  items: NavItem[];
}

/* ══════════════════════════════════════════════════════════
   Module groups — nguồn dữ liệu cho sidebar
   ══════════════════════════════════════════════════════════ */

const MODULE_GROUPS: NavGroup[] = [
  {
    title: "Thiết lập",
    icon: Settings,
    accentColor: "blue",
    route: "/setup",
    items: [
      { name: "Quản lý cơ sở", href: "/settings", icon: Settings, roles: ["admin"] },
      { name: "Quản lý ưu đãi", href: "/promotions", icon: Percent, roles: ["admin"] },
      { name: "Quản lý lớp học", href: "/classes", icon: GraduationCap, roles: ["admin", "manager", "staff", "teacher"] },
      { name: "Tùy chỉnh giao diện", href: "/settings/appearance", icon: Palette, roles: ["admin"] },
      { name: "Camera", href: "/settings/camera", icon: Camera, roles: ["admin"] },
    ],
  },
  {
    title: "Vận hành",
    icon: GraduationCap,
    accentColor: "indigo",
    route: "/operations",
    items: [
      { name: "Quản lý học viên", href: "/students", icon: Users, roles: ["admin", "manager", "staff", "teacher"] },
      { name: "Thời khóa biểu", href: "/schedule", icon: CalendarDays, roles: ["admin", "manager", "staff", "teacher"] },
      { name: "Điểm danh", href: "/attendance", icon: ClipboardCheck, roles: ["admin", "manager", "staff", "teacher"] },
      { name: "Check-in chờ xử lý", href: "/hanet-checkins", icon: Inbox, roles: ["admin", "manager", "staff", "teacher"] },
    ],
  },
  {
    title: "Chăm sóc KH",
    icon: MessageCircle,
    accentColor: "emerald",
    route: "/customer-care",
    items: [
      { name: "Chăm sóc KH (Zalo)", href: "/customer-care", icon: MessageCircle, roles: ["admin", "manager", "staff"] },
    ],
  },
  {
    title: "Kế toán – NS",
    icon: Wallet,
    accentColor: "amber",
    route: "/accounting",
    items: [
      { name: "Quản lý thu chi", href: "/finance", icon: Wallet, roles: ["admin", "manager", "staff"] },
      { name: "Quản lý nhân viên", href: "/hr", icon: Briefcase, roles: ["admin"] },
      { name: "Ca làm việc", href: "/shifts", icon: Clock, roles: ["admin", "manager", "staff", "teacher"] },
      { name: "Xếp ca", href: "/staff-shifts", icon: CalendarClock, roles: ["admin", "manager", "staff", "teacher"] },
      { name: "Bảng công", href: "/staff-attendance", icon: ClipboardList, roles: ["admin", "manager", "staff", "teacher"] },
      { name: "Quản lý kho", href: "/inventory", icon: Box, roles: ["admin", "manager"] },
    ],
  },
  {
    title: "Giám đốc TT",
    icon: BarChart3,
    accentColor: "rose",
    route: "/director",
    items: [
      { name: "Báo cáo", href: "/reports", icon: BarChart3, roles: ["admin", "manager"] },
    ],
  },
];

/* ══════════════════════════════════════════════════════════
   Flat navigation export — App.tsx dùng để check permissions
   (giữ nguyên cấu trúc cũ, chỉ thay đổi nguồn dữ liệu)
   ══════════════════════════════════════════════════════════ */

export const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "manager", "staff"] },
  ...MODULE_GROUPS.flatMap((group) => group.items),
];

/* ══════════════════════════════════════════════════════════
   Sidebar accent dot colors (phù hợp dark theme)
   ══════════════════════════════════════════════════════════ */

const SIDEBAR_DOT_COLOR: Record<AccentColor, string> = {
  blue: "bg-blue-400",
  indigo: "bg-indigo-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
};

/* ══════════════════════════════════════════════════════════
   Sidebar Component
   ══════════════════════════════════════════════════════════ */

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, dbUser, logout } = useAuth();
  const { settings } = useSettings();
  const userRole = dbUser?.role || "staff";

  /* ── Accordion state ──
     Dùng Set<string> chứa route của các group đang mở.
     Cho phép mở nhiều group cùng lúc. */
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // Khởi tạo: auto-expand group chứa route hiện tại
    const initial = new Set<string>();
    for (const group of MODULE_GROUPS) {
      const isCurrentRouteInGroup =
        group.items.some((item) => item.href === location.pathname) ||
        group.route === location.pathname;
      if (isCurrentRouteInGroup) {
        initial.add(group.route);
      }
    }
    return initial;
  });

  /* Auto-expand khi route thay đổi (navigate từ Dashboard, deep link, v.v.) */
  useEffect(() => {
    for (const group of MODULE_GROUPS) {
      const isCurrentRouteInGroup =
        group.items.some((item) => item.href === location.pathname) ||
        group.route === location.pathname;
      if (isCurrentRouteInGroup) {
        setExpandedGroups((prev) => {
          if (prev.has(group.route)) return prev; // Không tạo state mới nếu đã mở
          return new Set(prev).add(group.route);
        });
        break;
      }
    }
  }, [location.pathname]);

  const toggleGroup = useCallback((groupRoute: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupRoute)) {
        next.delete(groupRoute);
      } else {
        next.add(groupRoute);
      }
      return next;
    });
  }, []);

  /* ── Filter groups & items by RBAC ──
     Cùng logic với App.tsx + ModulePage:
     - admin: thấy tất cả
     - Có permissions: chỉ thấy item nằm trong permissions
     - Không permissions: fallback theo roles */
  const visibleGroups = useMemo(() => {
    return MODULE_GROUPS.map((group) => {
      const filteredItems = group.items.filter((item) => {
        if (userRole === "admin") return true;
        if (dbUser?.permissions) {
          return dbUser.permissions.includes(item.href);
        }
        return item.roles.includes(userRole);
      });
      return { ...group, items: filteredItems };
    }).filter((group) => group.items.length > 0);
  }, [userRole, dbUser?.permissions]);

  /* ── Logout handler ── */
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const centerName = settings?.centerName || "Schooling";

  return (
    <div className="flex h-full w-64 flex-col bg-[#1e293b] text-white transition-all duration-300">
      {/* ══ Logo / Tên trung tâm ══ */}
      <div className="flex h-16 w-full items-center px-6 font-bold text-xl tracking-wide border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          {settings?.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={centerName}
              className="h-8 w-8 rounded-lg object-cover bg-white"
            />
          ) : (
            <img
              src="/logo.png"
              alt="Schooling"
              className="h-8 w-8 rounded-lg object-contain"
            />
          )}
          <span className="text-slate-100 truncate w-40 text-left">
            {centerName}
          </span>
        </div>
      </div>

      {/* ══ Navigation ══ */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {/* ── Dashboard — luôn top-level ── */}
          <Link
            to="/"
            className={cn(
              "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname === "/"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-700 hover:text-white",
            )}
          >
            <LayoutDashboard
              className={cn(
                "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                location.pathname === "/"
                  ? "text-white"
                  : "text-slate-400 group-hover:text-white",
              )}
              aria-hidden="true"
            />
            Dashboard
          </Link>

          {/* ── Separator ── */}
          <div className="my-3 border-t border-slate-700/50" />

          {/* ── Module groups ── */}
          {visibleGroups.map((group) => {
            const isOpen = expandedGroups.has(group.route);
            const isGroupActive =
              group.items.some((item) => item.href === location.pathname) ||
              group.route === location.pathname;
            const dotColor = SIDEBAR_DOT_COLOR[group.accentColor];

            return (
              <div key={group.route} className="space-y-0.5">
                {/* Group header — click to toggle expand/collapse */}
                <button
                  onClick={() => toggleGroup(group.route)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isGroupActive
                      ? "text-white bg-slate-700/50"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full flex-shrink-0",
                        dotColor,
                      )}
                    />
                    <span className="truncate">{group.title}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 flex-shrink-0 text-slate-500 transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {/* Group items — accordion (CSS grid-rows transition) */}
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-0.5 pl-3 pt-0.5 pb-1">
                      {group.items.map((item) => {
                        const isItemActive =
                          location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                              "group/item flex items-center rounded-md px-3 py-2 text-sm transition-colors",
                              isItemActive
                                ? "bg-blue-600 text-white shadow-sm font-medium"
                                : "text-slate-300 hover:bg-slate-700 hover:text-white",
                            )}
                          >
                            <item.icon
                              className={cn(
                                "mr-2.5 h-4 w-4 flex-shrink-0 transition-colors",
                                isItemActive
                                  ? "text-white"
                                  : "text-slate-400 group-hover/item:text-white",
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* ══ User info + Logout ══ */}
      <div className="border-t border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-600 flex items-center justify-center font-semibold text-sm">
              {dbUser?.name?.charAt(0) ||
                user?.email?.charAt(0)?.toUpperCase() ||
                "A"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white truncate w-32">
                {dbUser?.name || "Người dùng"}
              </span>
              <span className="text-xs text-slate-400 truncate w-32">
                {dbUser?.role === "admin" ? "Quản trị viên" : "Nhân viên"}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition-colors"
            title="Đăng xuất"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}
