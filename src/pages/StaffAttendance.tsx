import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

interface AttendanceRecord {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string;
  workDate: string;
  shiftId: number | null;
  shiftName: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  source: string;
  note: string | null;
}

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

interface User {
  id: number;
  name: string | null;
  email: string;
  role: string;
}

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const formatTime = (t: string) => t?.slice(0, 5) || "";
const formatHM = (dt: string | null): string => {
  if (!dt) return "--:--";
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function StaffAttendance() {
  const { dbUser } = useAuth();
  const canEdit = dbUser?.role === "admin" || dbUser?.role === "manager";

  // Tháng hiện tại
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1); // 1-12

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filterUserId, setFilterUserId] = useState("");

  // Modal chấm công / sửa công
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    userId: "",
    workDate: "",
    shiftId: "",
    checkInTime: "",
    checkOutTime: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  const fetchData = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const token = await auth.currentUser?.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        const params = new URLSearchParams({ startDate, endDate });
        if (filterUserId) params.set("userId", filterUserId);

        const [attRes, shiftsRes, usersRes] = await Promise.all([
          fetch(`/api/staff-attendance?${params}`, { headers }),
          fetch("/api/shifts", { headers }),
          fetch("/api/users", { headers }),
        ]);

        if (!attRes.ok) {
          const data = await attRes.json().catch(() => ({}));
          setError(data.error || "Không tải được bảng công.");
          return;
        }
        setRecords(await attRes.json());
        if (shiftsRes.ok) setAllShifts(await shiftsRes.json());
        if (usersRes.ok) {
          const list: User[] = await usersRes.json();
          setAllUsers(list.filter((u) => u.role !== "admin"));
        }
      } catch {
        setError("Lỗi kết nối.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate, filterUserId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  // ---- Modal handlers ----
  const openNewModal = () => {
    setFormData({ userId: "", workDate: "", shiftId: "", checkInTime: "", checkOutTime: "", note: "" });
    setEditingId(null);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (record: AttendanceRecord) => {
    setFormData({
      userId: String(record.userId),
      workDate: record.workDate,
      shiftId: record.shiftId ? String(record.shiftId) : "",
      checkInTime: record.checkInTime ? new Date(record.checkInTime).toTimeString().slice(0, 5) : "",
      checkOutTime: record.checkOutTime ? new Date(record.checkOutTime).toTimeString().slice(0, 5) : "",
      note: record.note || "",
    });
    setEditingId(record.id);
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!editingId && (!formData.userId || !formData.workDate)) {
      setFormError("Vui lòng chọn nhân viên và ngày.");
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();

      // Xây datetime từ date + time input
      const buildDateTime = (date: string, time: string): string | null => {
        if (!time) return null;
        return `${date}T${time}:00`;
      };

      const payload = editingId
        ? {
            checkInTime: buildDateTime(formData.workDate, formData.checkInTime),
            checkOutTime: buildDateTime(formData.workDate, formData.checkOutTime),
            shiftId: formData.shiftId || null,
            note: formData.note || null,
          }
        : {
            userId: formData.userId,
            workDate: formData.workDate,
            shiftId: formData.shiftId || null,
            checkInTime: buildDateTime(formData.workDate, formData.checkInTime),
            checkOutTime: buildDateTime(formData.workDate, formData.checkOutTime),
            note: formData.note || null,
          };

      const url = editingId ? `/api/staff-attendance/${editingId}` : "/api/staff-attendance";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        fetchData(true);
      } else {
        const data = await res.json();
        setFormError(data.error || "Lưu thất bại.");
      }
    } catch {
      setFormError("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  const getDayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return WEEKDAY_SHORT[d.getDay()];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Bảng công</h2>
          <p className="mt-1 text-sm text-slate-500">Giờ vào, giờ ra, đi muộn, về sớm theo tháng.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {canEdit && (
            <button onClick={openNewModal} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Chấm công tay
            </button>
          )}
        </div>
      </div>

      {/* Month nav + filter */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-semibold text-slate-900">
            Tháng {month}/{year}
          </span>
          <button onClick={nextMonth} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {canEdit && (
          <select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} className="rounded-md border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500">
            <option value="">Tất cả nhân viên</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-white p-12 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang tải...
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
          <ClipboardList className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-base font-medium text-slate-900">Chưa có bản ghi công</p>
          <p className="mt-1 text-sm text-slate-500">
            {canEdit ? 'Bấm "Chấm công tay" để thêm bản ghi.' : "Bạn chưa có dữ liệu công trong tháng này."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[48rem] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nhân viên</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ca</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Giờ vào</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Giờ ra</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Muộn</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Về sớm</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú</th>
                {canEdit && <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const hasIssue = r.lateMinutes > 0 || r.earlyLeaveMinutes > 0;
                return (
                  <tr key={r.id} className={`border-b border-slate-100 last:border-0 ${hasIssue ? "bg-red-50/50" : "hover:bg-slate-50"}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{r.userName || r.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                      {r.workDate.split("-").reverse().join("/")}
                      <span className="ml-1 text-xs text-slate-400">({getDayOfWeek(r.workDate)})</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                      {r.shiftName ? (
                        <span>{r.shiftName} <span className="text-xs text-slate-400">({formatTime(r.shiftStartTime || "")}–{formatTime(r.shiftEndTime || "")})</span></span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-slate-700">{formatHM(r.checkInTime)}</td>
                    <td className="px-4 py-3 text-center text-sm font-mono text-slate-700">{formatHM(r.checkOutTime)}</td>
                    <td className="px-4 py-3 text-center text-sm">
                      {r.lateMinutes > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{r.lateMinutes}p</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {r.earlyLeaveMinutes > 0 ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{r.earlyLeaveMinutes}p</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-[12rem] truncate" title={r.note || ""}>
                      {r.note || ""}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openEditModal(r)} className="text-indigo-600 hover:text-indigo-900" title="Sửa">
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal chấm công / sửa công */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingId ? "Sửa bản ghi công" : "Chấm công thủ công"}
              </h3>
            </div>
            <form onSubmit={handleSave} className="space-y-4 p-6">
              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</div>
              )}

              {!editingId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nhân viên *</label>
                    <select required value={formData.userId} onChange={(e) => setFormData({ ...formData, userId: e.target.value })} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500">
                      <option value="">-- Chọn --</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ngày *</label>
                    <input type="date" required value={formData.workDate} onChange={(e) => setFormData({ ...formData, workDate: e.target.value })} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ca làm việc</label>
                <select value={formData.shiftId} onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500">
                  <option value="">-- Không chọn --</option>
                  {allShifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({formatTime(s.startTime)}–{formatTime(s.endTime)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Giờ vào</label>
                  <input type="time" value={formData.checkInTime} onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Giờ ra</label>
                  <input type="time" value={formData.checkOutTime} onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
                <input type="text" value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="Vd: Quên quét thẻ, nghỉ phép..." />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  Hủy
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
