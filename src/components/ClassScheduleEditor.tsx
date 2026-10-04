import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, AlertCircle, Loader2, CalendarDays } from "lucide-react";
import { auth } from "../lib/firebase";

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

interface ScheduleRow {
  id: number;
  shiftId: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
}

interface ClassScheduleEditorProps {
  classId: number;
}

// Quy ước 1 = Thứ 2 ... 7 = Chủ nhật. Dùng quy ước này thay vì kiểu 0 = Chủ nhật của
// JavaScript, vì người Việt đọc lịch bắt đầu từ thứ 2 - tránh lệch một ngày khi hiển thị.
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Thứ 2", short: "T2" },
  { value: 2, label: "Thứ 3", short: "T3" },
  { value: 3, label: "Thứ 4", short: "T4" },
  { value: 4, label: "Thứ 5", short: "T5" },
  { value: 5, label: "Thứ 6", short: "T6" },
  { value: 6, label: "Thứ 7", short: "T7" },
  { value: 7, label: "Chủ nhật", short: "CN" },
];

/** Máy chủ trả "07:30:00", hiển thị gọn thành "07:30". */
export function toShortTime(value: string): string {
  return value ? value.slice(0, 5) : "";
}

export function ClassScheduleEditor({ classId }: ClassScheduleEditorProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newDay, setNewDay] = useState<number | "">("");
  const [newShiftId, setNewShiftId] = useState<number | "">("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [shiftsRes, schedulesRes] = await Promise.all([
        fetch("/api/shifts", { headers }),
        fetch(`/api/class-schedules?classId=${classId}`, { headers }),
      ]);
      if (shiftsRes.ok) setShifts(await shiftsRes.json());
      if (schedulesRes.ok) {
        setRows(await schedulesRes.json());
      } else {
        const data = await schedulesRes.json().catch(() => ({}));
        setError(data.error || "Không tải được lịch học.");
      }
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    if (!newDay || !newShiftId) {
      setError("Vui lòng chọn cả thứ và ca.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/class-schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ classId, shiftId: newShiftId, dayOfWeek: newDay }),
      });
      if (res.ok) {
        setNewDay("");
        setNewShiftId("");
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Thêm lịch thất bại.");
      }
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    setRemovingId(id);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/class-schedules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Xóa lịch thất bại.");
      }
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-slate-500" />
        <h4 className="text-sm font-medium text-slate-900">Thời khóa biểu</h4>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Thay đổi ở đây được lưu ngay, không cần bấm nút lưu của form.
      </p>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      ) : (
        <>
          {rows.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                >
                  <span className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded bg-blue-50 px-1.5 text-xs font-medium text-blue-700">
                    {WEEKDAYS.find((d) => d.value === row.dayOfWeek)?.short ?? "?"}
                  </span>
                  <span className="flex-1 truncate text-slate-700">
                    {row.shiftName}
                    <span className="ml-2 text-slate-400">
                      {toShortTime(row.startTime)}–{toShortTime(row.endTime)}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={removingId === row.id}
                    onClick={() => handleRemove(row.id)}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Gỡ buổi này"
                  >
                    {removingId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Lớp này chưa có buổi học nào trong tuần.</p>
          )}

          {shifts.length === 0 ? (
            <p className="mt-3 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/20">
              Chưa có ca làm việc nào. Vào Quản lý cơ sở → tab Ca làm việc để tạo trước.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[7rem] flex-1">
                <label className="block text-xs font-medium text-slate-600">Thứ</label>
                <select
                  value={newDay}
                  onChange={(e) => { setNewDay(e.target.value ? parseInt(e.target.value) : ""); setError(""); }}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                >
                  <option value="">-- Chọn --</option>
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[10rem] flex-[2]">
                <label className="block text-xs font-medium text-slate-600">Ca</label>
                <select
                  value={newShiftId}
                  onChange={(e) => { setNewShiftId(e.target.value ? parseInt(e.target.value) : ""); setError(""); }}
                  className="mt-1 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                >
                  <option value="">-- Chọn --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({toShortTime(s.startTime)}–{toShortTime(s.endTime)})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={adding}
                onClick={handleAdd}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Thêm
              </button>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
