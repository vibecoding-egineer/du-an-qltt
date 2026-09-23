import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Bell, Search, User } from "lucide-react";

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-96">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Tìm kiếm học viên, lớp học..."
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-400 hover:text-slate-500">
              <Bell className="h-6 w-6" />
              <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <User className="h-5 w-5" />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
