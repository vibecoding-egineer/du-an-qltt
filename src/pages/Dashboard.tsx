import React from "react";
import { Users, GraduationCap, DollarSign, Wallet } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function Dashboard() {
  const { dbUser } = useAuth();
  
  const stats = [
    { name: "Học viên đang học", value: "1,240", icon: Users, color: "text-blue-600", bg: "bg-blue-100", show: true },
    { name: "Lớp đang hoạt động", value: "86", icon: GraduationCap, color: "text-indigo-600", bg: "bg-indigo-100", show: true },
    { name: "Doanh thu tháng (VNĐ)", value: "450M", icon: DollarSign, color: "text-green-600", bg: "bg-green-100", show: dbUser?.role === 'admin' || dbUser?.role === 'manager' },
    { name: "Chưa thu (VNĐ)", value: "24M", icon: Wallet, color: "text-red-600", bg: "bg-red-100", show: dbUser?.role === 'admin' || dbUser?.role === 'manager' },
  ].filter(s => s.show);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {dbUser?.role === 'admin' ? 'Tổng quan Toàn Hệ Thống' : 'Tổng quan Hoạt Động'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">Xem nhanh các chỉ số hoạt động trong tháng.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Lớp học sắp diễn ra</h3>
          <div className="mt-4 flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <span className="text-sm text-slate-500">Chưa có dữ liệu lớp học</span>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Hoạt động gần đây</h3>
          <div className="mt-4 flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <span className="text-sm text-slate-500">Chưa có hoạt động</span>
          </div>
        </div>
      </div>
    </div>
  );
}
