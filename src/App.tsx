/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Employees } from "./pages/Employees";
import { Branches } from "./pages/Branches";
import { Classes } from "./pages/Classes";
import { Students } from "./pages/Students";
import { Attendance } from "./pages/Attendance";
import { Finance } from "./pages/Finance";
import { Promotions } from "./pages/Promotions";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { navigation } from "./components/Sidebar";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, dbUser, loading, needsOnboarding, refreshDbUser } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsOnboarding) {
    return <Onboarding onComplete={refreshDbUser} />;
  }

  // Permission Check
  if (dbUser && dbUser.role !== 'admin') {
    const currentPath = location.pathname;
    
    // Always allow access to dashboard
    if (currentPath === '/') return <>{children}</>;

    const navItem = navigation.find(item => item.href === currentPath);
    
    if (navItem) {
      if (dbUser.permissions) {
        if (!dbUser.permissions.includes(currentPath)) {
           return (
             <div className="flex h-screen items-center justify-center flex-col text-slate-500">
               <p className="text-xl font-medium text-slate-900">Truy cập bị từ chối</p>
               <p className="mt-2 text-sm">Bạn không có quyền truy cập vào module này.</p>
             </div>
           );
        }
      } else if (!navItem.roles.includes(dbUser.role)) {
         return (
           <div className="flex h-screen items-center justify-center flex-col text-slate-500">
             <p className="text-xl font-medium text-slate-900">Truy cập bị từ chối</p>
             <p className="mt-2 text-sm">Bạn không có quyền truy cập vào module này.</p>
           </div>
         );
      }
    }
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="hr" element={<Employees />} />
              <Route path="settings" element={<Branches />} />
              <Route path="classes" element={<Classes />} />
              <Route path="students" element={<Students />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="finance" element={<Finance />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="*" element={
                <div className="flex h-full items-center justify-center flex-col text-slate-500">
                  <p className="text-xl font-medium text-slate-900">Chưa triển khai</p>
                  <p className="mt-2 text-sm">Module này đang trong quá trình phát triển.</p>
                </div>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}
