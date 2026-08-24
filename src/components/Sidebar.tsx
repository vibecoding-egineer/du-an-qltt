import React, { useState } from "react";
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
  Menu,
  ClipboardCheck,
  Percent,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { SettingsModal } from "./SettingsModal";

export const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ['admin', 'manager', 'staff'] },
  { name: "Quản lý cơ sở", href: "/settings", icon: Settings, roles: ['admin'] },
  { name: "Quản lý ưu đãi", href: "/promotions", icon: Percent, roles: ["admin"] },
  { name: "Quản lý lớp học", href: "/classes", icon: GraduationCap, roles: ['admin', 'manager', 'staff', 'teacher'] },
  { name: "Quản lý học viên", href: "/students", icon: Users, roles: ['admin', 'manager', 'staff', 'teacher'] },
  { name: "Điểm danh", href: "/attendance", icon: ClipboardCheck,
  Percent, roles: ['admin', 'manager', 'staff', 'teacher'] },
  { name: "Chăm sóc KH (Zalo)", href: "/customer-care", icon: MessageCircle, roles: ['admin', 'manager', 'staff'] },
  { name: "Quản lý thu chi", href: "/finance", icon: Wallet, roles: ['admin', 'manager', 'staff'] },
  { name: "Quản lý nhân viên", href: "/hr", icon: Briefcase, roles: ['admin'] },
  { name: "Quản lý kho", href: "/inventory", icon: Box, roles: ['admin', 'manager'] },
  { name: "Báo cáo", href: "/reports", icon: BarChart3, roles: ['admin', 'manager'] },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, dbUser, logout } = useAuth();
  const { settings } = useSettings();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const userRole = dbUser?.role || 'staff';
  const userPermissions = dbUser?.permissions || [];

  const filteredNav = navigation.filter(item => {
    if (userRole === 'admin') return true;
    if (item.href === '/') return true;
    if (dbUser?.permissions) {
      return userPermissions.includes(item.href);
    }
    // Fallback to role if no permissions defined
    return item.roles.includes(userRole);
  });
  
  const centerName = settings?.centerName || "Eduspace";
  const initial = centerName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-64 flex-col bg-[#1e293b] text-white transition-all duration-300">
      <button 
        onClick={() => { if (userRole === 'admin') setShowSettingsModal(true); }}
        className={cn(
          "flex h-16 w-full items-center px-6 font-bold text-xl tracking-wide border-b border-slate-700/50 outline-none",
          userRole === 'admin' ? "hover:bg-slate-800 transition-colors cursor-pointer" : "cursor-default"
        )}
      >
        <div className="flex items-center gap-2">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt={centerName} className="h-8 w-8 rounded-lg object-cover bg-white" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
              {initial}
            </div>
          )}
          <span className="text-slate-100 truncate w-40 text-left">{centerName}</span>
        </div>
      </button>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                    isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="border-t border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-600 flex items-center justify-center font-semibold text-sm">
              {dbUser?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white truncate w-32">{dbUser?.name || 'Người dùng'}</span>
              <span className="text-xs text-slate-400 truncate w-32">{dbUser?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-700 transition-colors"
            title="Đăng xuất"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </div>
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
    </div>
  );
}
