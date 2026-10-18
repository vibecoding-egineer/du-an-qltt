/**
 * ModulePage — Component dùng chung cho 5 trang module.
 *
 * Nhận danh sách tính năng con, hiển thị dạng card grid với:
 * - Staggered fade-in khi vào trang
 * - Hover: scale lên nhẹ + bóng đổ
 * - Click: press effect (scale xuống)
 * - Badge "Sắp ra mắt" cho tính năng chưa triển khai
 * - Lọc theo phân quyền RBAC (giống logic Sidebar + App.tsx)
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

export interface ModuleFeature {
  /** Tên tính năng hiển thị trên card */
  name: string;
  /** Mô tả ngắn gọn (1 dòng) */
  description: string;
  /** Route path — VD: "/students", "/finance" */
  href: string;
  /** Icon lucide-react */
  icon: LucideIcon;
  /** true = đã triển khai, false = hiện badge "Sắp ra mắt" */
  available: boolean;
  /** Roles được phép truy cập (fallback khi user chưa có permissions array) */
  roles: string[];
}

export type AccentColor = "blue" | "indigo" | "emerald" | "amber" | "rose";

interface ModulePageProps {
  /** Tiêu đề module — VD: "Thiết lập – Khởi tạo – Cài đặt" */
  title: string;
  /** Mô tả ngắn bên dưới tiêu đề */
  description: string;
  /** Icon đại diện module */
  icon: LucideIcon;
  /** Màu chủ đạo — quyết định màu icon, header */
  accentColor: AccentColor;
  /** Danh sách tính năng con trong module */
  features: ModuleFeature[];
}

/* ══════════════════════════════════════════════════════════
   Tailwind JIT-safe color map
   (Không dùng template string `bg-${color}-100` vì Tailwind
   purge sẽ xóa class động — phải liệt kê đầy đủ ở đây)
   ══════════════════════════════════════════════════════════ */

const ACCENT_STYLES: Record<
  AccentColor,
  { iconBg: string; iconText: string }
> = {
  blue:    { iconBg: "bg-blue-100",    iconText: "text-blue-600"    },
  indigo:  { iconBg: "bg-indigo-100",  iconText: "text-indigo-600"  },
  emerald: { iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
  amber:   { iconBg: "bg-amber-100",   iconText: "text-amber-600"   },
  rose:    { iconBg: "bg-rose-100",    iconText: "text-rose-600"    },
};

/* ══════════════════════════════════════════════════════════
   CSS keyframes — staggered card entrance
   ══════════════════════════════════════════════════════════ */

const KEYFRAMES = `
@keyframes moduleCardEnter {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.module-card-animate {
  opacity: 0;
  animation: moduleCardEnter 0.4s ease-out forwards;
}
@keyframes moduleHeaderEnter {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
.module-header-animate {
  opacity: 0;
  animation: moduleHeaderEnter 0.35s ease-out forwards;
}
`;

/* ══════════════════════════════════════════════════════════
   ModulePage
   ══════════════════════════════════════════════════════════ */

export function ModulePage({
  title,
  description,
  icon: ModuleIcon,
  accentColor,
  features,
}: ModulePageProps) {
  const navigate = useNavigate();
  const { dbUser } = useAuth();

  const userRole = dbUser?.role || "staff";

  /**
   * Lọc tính năng theo quyền — cùng logic với Sidebar.tsx và App.tsx:
   * - admin: thấy tất cả
   * - Có permissions array: chỉ thấy route nằm trong danh sách
   * - Không có permissions: fallback theo roles
   */
  const visibleFeatures = useMemo(() => {
    return features.filter((feature) => {
      if (userRole === "admin") return true;
      if (dbUser?.permissions) {
        return dbUser.permissions.includes(feature.href);
      }
      return feature.roles.includes(userRole);
    });
  }, [features, userRole, dbUser?.permissions]);

  const accent = ACCENT_STYLES[accentColor];

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="module-header-animate flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Quay lại trang chủ"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                accent.iconBg,
              )}
            >
              <ModuleIcon className={cn("h-6 w-6", accent.iconText)} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500">{description}</p>
            </div>
          </div>
        </div>

        {/* ── Feature grid ── */}
        {visibleFeatures.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFeatures.map((feature, index) => (
              <FeatureCard
                key={feature.href}
                feature={feature}
                index={index}
                accent={accent}
                onNavigate={navigate}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50">
            <Lock className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              Bạn chưa có quyền truy cập module này
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   FeatureCard (component nội bộ)
   ══════════════════════════════════════════════════════════ */

interface FeatureCardProps {
  feature: ModuleFeature;
  /** Thứ tự card — quyết định animation-delay */
  index: number;
  accent: { iconBg: string; iconText: string };
  onNavigate: (path: string) => void;
}

function FeatureCard({ feature, index, accent, onNavigate }: FeatureCardProps) {
  const {
    icon: FeatureIcon,
    name,
    description: featureDescription,
    href,
    available,
  } = feature;

  const handleClick = () => {
    if (available) {
      onNavigate(href);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!available}
      className={cn(
        "module-card-animate",
        "group relative flex items-start gap-4 rounded-xl p-5 text-left",
        "ring-1 ring-inset transition-all duration-200",
        available
          ? "bg-white ring-slate-200 hover:ring-slate-300 hover:shadow-lg hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
          : "bg-slate-50/80 ring-slate-200/60 cursor-not-allowed",
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
          available ? accent.iconBg : "bg-slate-100",
        )}
      >
        <FeatureIcon
          className={cn(
            "h-5 w-5 transition-colors",
            available ? accent.iconText : "text-slate-400",
          )}
        />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            available
              ? "text-slate-900 group-hover:text-slate-700"
              : "text-slate-400",
          )}
        >
          {name}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs leading-relaxed",
            available ? "text-slate-500" : "text-slate-400",
          )}
        >
          {featureDescription}
        </p>
      </div>

      {/* Badge "Sắp ra mắt" cho tính năng chưa triển khai */}
      {!available && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          <Clock className="h-3 w-3" />
          Sắp ra mắt
        </span>
      )}
    </button>
  );
}
