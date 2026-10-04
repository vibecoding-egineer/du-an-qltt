import React, { useCallback, useEffect, useState } from "react";
import { Users, GraduationCap, DollarSign, Wallet, Clock, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../lib/firebase";
import { toShortTime } from "../components/ClassScheduleEditor";

interface ScheduleEntry {
  id: number;
  classId: number;
  className: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
}

type ClassStatus = "done" | "ongoing" | "upcoming";

const STATUS_STYLE: Record<ClassStatus, { label: string; tone: string }> = {
  ongoing: { label: "Đang học", tone: "bg-green-50 text-green-800 ring-green-600/20" },
  upcoming: { label: "Sắp tới", tone: "bg-blue-50 text-blue-800 ring-blue-600/20" },
  done: { label: "Đã xong", tone: "bg-slate-100 text-slate-500 ring-slate-500/20" },
};

export function Dashboard() {
  const { dbUser } = useAuth();

  const [todayClasses, setTodayClasses] = useState<ScheduleEntry[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  // Cập nhật mỗi phút để trạng thái "đang học / sắp tới" không đứng yên khi người dùng mở
  // màn hình lâu. Chỉ tính lại từ dữ liệu đã có, không gọi lại máy chủ.
  const [now, setNow] = useState(new Date());

  const stats = [
    { name: "Học viên đang học", value: "1,240", icon: Users, color: "text-blue-600", bg: "bg-blue-100", show: true },
    { name: "Lớp đang hoạt động", value: "86", icon: GraduationCap, color: "text-indigo-600", bg: "bg-indigo-100", show: true },
    { name: "Doanh thu tháng (VNĐ)", value: "450M", icon: DollarSign, color: "text-green-600", bg: "bg-green-100", show: dbUser?.role === 'admin' || dbUser?.role === 'manager' },
    { name: "Chưa thu (VNĐ)", value: "24M", icon: Wallet, color: "text-red-600", bg: "bg-red-100", show: dbUser?.role === 'admin' || dbUser?.role === 'manager' },
  ].filter(s => s.show);

  const fetchTodaySchedule = useCallback(async () => {
    setLoadingSchedule(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/class-schedules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const all: ScheduleEntry[] = await res.json();
        // getDay() trả 0 cho Chủ nhật, còn hệ thống quy ước 7 - phải quy đổi, nếu không
        // mỗi Chủ nhật sẽ hiện nhầm lịch của Thứ 2.
        const jsDay = new Date().getDay();
        const todayValue = jsDay === 0 ? 7 : jsDay;
        setTodayClasses(
          all
            .filter((e) => e.dayOfWeek === todayValue)
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    fetchTodaySchedule();
  }, [fetchTodaySchedule]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;

  const statusOf = (entry: ScheduleEntry): ClassStatus => {
    if (currentTime >= entry.endTime) return "done";
    if (currentTime >= entry.startTime) return "ongoing";
    return "upcoming";
  };

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
          <h3 className="text-lg font-semibold text-slate-900">Lớp học hôm nay</h3>

          {loadingSchedule ? (
            <div className="mt-4 flex h-64 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải...
            </div>
          ) : todayClasses.length === 0 ? (
            <div className="mt-4 flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
              <Clock className="h-8 w-8 text-slate-300" />
              <span className="text-sm text-slate-500">Hôm nay không có lớp nào theo thời khóa biểu</span>
              <span className="text-xs text-slate-400">
                Xếp lịch tại Quản lý lớp học → mở lớp → Thời khóa biểu
              </span>
            </div>
          ) : (
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {todayClasses.map((entry) => {
                const status = statusOf(entry);
                const style = STATUS_STYLE[status];
                return (
                  <li
                    key={entry.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset ring-slate-200 ${
                      status === "done" ? "bg-slate-50" : "bg-white"
                    }`}
                  >
                    <div className="w-24 flex-shrink-0 text-sm font-medium text-slate-700">
                      {toShortTime(entry.startTime)}–{toShortTime(entry.endTime)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm font-medium ${status === "done" ? "text-slate-500" : "text-slate-900"}`}>
                        {entry.className}
                      </div>
                      <div className="truncate text-xs text-slate-400">{entry.shiftName}</div>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.tone}`}>
                      {style.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
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
