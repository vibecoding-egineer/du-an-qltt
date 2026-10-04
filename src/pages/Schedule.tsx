import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { auth } from "../lib/firebase";
import { WEEKDAYS, toShortTime } from "../components/ClassScheduleEditor";

interface ScheduleEntry {
  id: number;
  classId: number;
  className: string;
  shiftId: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
}

interface ShiftRow {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

export function Schedule() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [schedulesRes, shiftsRes] = await Promise.all([
        fetch("/api/class-schedules", { headers }),
        fetch("/api/shifts", { headers }),
      ]);
      if (!schedulesRes.ok) {
        const data = await schedulesRes.json().catch(() => ({}));
        setError(data.error || "Không tải được thời khóa biểu.");
        return;
      }
      setEntries(await schedulesRes.json());
      if (shiftsRes.ok) setShifts(await shiftsRes.json());
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chỉ hiện những ca thực sự có lớp học, để bảng không bị loãng bởi các ca trống.
  // Nếu trung tâm có 10 ca mà chỉ dùng 3, hiện cả 10 sẽ khiến bảng khó đọc.
  const usedShiftIds = new Set(entries.map((e) => e.shiftId));
  const visibleShifts = shifts.filter((s) => usedShiftIds.has(s.id));

  const entriesAt = (shiftId: number, day: number) =>
    entries.filter((e) => e.shiftId === shiftId && e.dayOfWeek === day);

  // Ngày hôm nay theo quy ước 1 = Thứ 2 ... 7 = Chủ nhật.
  // getDay() trả 0 cho Chủ nhật nên phải quy đổi, nếu không cột Chủ nhật sẽ bị lệch.
  const jsDay = new Date().getDay();
  const todayValue = jsDay === 0 ? 7 : jsDay;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Thời khóa biểu</h2>
          <p className="mt-1 text-sm text-slate-500">
            Lịch học cố định hằng tuần. Xếp lịch cho từng lớp tại Quản lý lớp học → mở lớp → Thời khóa biểu.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 self-start rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => fetchData()} className="font-medium text-red-600 hover:text-red-800">
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-white p-12 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          Đang tải...
        </div>
      ) : visibleShifts.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
          <CalendarDays className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-base font-medium text-slate-900">Chưa có lịch học nào</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Vào Quản lý lớp học, mở một lớp rồi xếp buổi học vào các ca trong tuần. Lịch sẽ
            hiện ở đây.
          </p>
        </div>
      ) : (
        // Bảng rộng nên cho cuộn ngang trong khung riêng, tránh cả trang bị đẩy ngang
        // trên màn hình nhỏ.
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[56rem] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-10 w-40 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ca
                </th>
                {WEEKDAYS.map((d) => (
                  <th
                    key={d.value}
                    className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide ${
                      d.value === todayValue ? "bg-blue-50 text-blue-700" : "text-slate-500"
                    }`}
                  >
                    {d.label}
                    {d.value === todayValue && (
                      <span className="ml-1 font-normal normal-case">(hôm nay)</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleShifts.map((shift) => (
                <tr key={shift.id} className="border-b border-slate-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top">
                    <div className="text-sm font-medium text-slate-900">{shift.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {toShortTime(shift.startTime)}–{toShortTime(shift.endTime)}
                    </div>
                  </td>
                  {WEEKDAYS.map((d) => {
                    const cell = entriesAt(shift.id, d.value);
                    return (
                      <td
                        key={d.value}
                        className={`px-2 py-3 align-top ${d.value === todayValue ? "bg-blue-50/40" : ""}`}
                      >
                        {cell.length === 0 ? (
                          <span className="block text-center text-xs text-slate-300">–</span>
                        ) : (
                          <div className="space-y-1.5">
                            {cell.map((e) => (
                              <div
                                key={e.id}
                                className="truncate rounded-md bg-indigo-50 px-2 py-1.5 text-xs font-medium text-indigo-800 ring-1 ring-inset ring-indigo-600/20"
                                title={e.className}
                              >
                                {e.className}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
