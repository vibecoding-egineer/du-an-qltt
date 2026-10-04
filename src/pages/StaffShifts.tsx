import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

interface ShiftAssignment {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string;
  shiftId: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  workDate: string;
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
  branchId: number | null;
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const formatTime = (t: string) => t?.slice(0, 5) || "";

/** Lấy ngày đầu tuần (Thứ 2) chứa date. */
const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const formatDateShort = (d: Date): string =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export function StaffShifts() {
  const { dbUser } = useAuth();
  const canEdit = dbUser?.role === "admin" || dbUser?.role === "manager";

  const [monday, setMonday] = useState(() => getMonday(new Date()));
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Quick-assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignShiftId, setAssignShiftId] = useState("");
  const [assignDates, setAssignDates] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Inline assign (click empty cell)
  const [inlineCell, setInlineCell] = useState<{ userId: number; date: string } | null>(null);
  const [inlineShiftId, setInlineShiftId] = useState("");

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });

  const sunday = weekDates[6];

  const fetchData = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const token = await auth.currentUser?.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        const startDate = toDateStr(monday);
        const endSun = new Date(monday);
        endSun.setDate(endSun.getDate() + 6);
        const endDate = toDateStr(endSun);
        

        const [assignRes, shiftsRes, usersRes] = await Promise.all([
          fetch(`/api/staff-shifts?startDate=${startDate}&endDate=${endDate}`, { headers }),
          fetch("/api/shifts", { headers }),
          fetch("/api/users", { headers }),
        ]);

        if (!assignRes.ok) {
          const data = await assignRes.json().catch(() => ({}));
          setError(data.error || "Không tải được phân ca.");
          return;
        }
        setAssignments(await assignRes.json());
        if (shiftsRes.ok) setAllShifts(await shiftsRes.json());
        if (usersRes.ok) {
          const list: User[] = await usersRes.json();
          setAllUsers(list.filter((u) => u.role !== "admin" || u.id === dbUser?.id));
        }
      } catch {
        setError("Lỗi kết nối.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [monday, dbUser?.id],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    setMonday(d);
  };
  const nextWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    setMonday(d);
  };
  const goToday = () => setMonday(getMonday(new Date()));

  // Unique users visible in the grid
  const userIds = [...new Set(assignments.map((a) => a.userId))];
  // If admin/manager, also show users with NO assignments this week
  const allVisibleUsers = canEdit
    ? allUsers.filter((u) => u.role !== "admin")
    : allUsers.filter((u) => u.id === dbUser?.id);
  const displayUsers = allVisibleUsers.length > 0 ? allVisibleUsers : [];

  const getAssignments = (userId: number, date: string) =>
    assignments.filter((a) => a.userId === userId && a.workDate === date);

  const todayStr = toDateStr(new Date());

  // ---- Handlers ----
  const handleDelete = async (id: number) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/staff-shifts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchData(true);
      else {
        const data = await res.json();
        alert(data.error || "Xóa thất bại");
      }
    } catch {
      alert("Lỗi kết nối");
    }
  };

  const handleInlineAssign = async () => {
    if (!inlineCell || !inlineShiftId) return;
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/staff-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: inlineCell.userId,
          shiftId: inlineShiftId,
          workDate: inlineCell.date,
        }),
      });
      if (res.ok) {
        setInlineCell(null);
        setInlineShiftId("");
        fetchData(true);
      } else {
        const data = await res.json();
        alert(data.error || "Phân ca thất bại");
      }
    } catch {
      alert("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!assignUserId || !assignShiftId || assignDates.size === 0) return;
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/staff-shifts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: assignUserId,
          shiftId: assignShiftId,
          dates: Array.from(assignDates),
        }),
      });
      if (res.ok) {
        setShowAssignModal(false);
        setAssignUserId("");
        setAssignShiftId("");
        setAssignDates(new Set());
        fetchData(true);
      } else {
        const data = await res.json();
        alert(data.error || "Phân ca thất bại");
      }
    } catch {
      alert("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  };

  const openBulkModal = () => {
    setAssignUserId("");
    setAssignShiftId("");
    setAssignDates(new Set());
    setShowAssignModal(true);
  };

  const toggleDate = (date: string) => {
    setAssignDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Xếp ca nhân viên</h2>
          <p className="mt-1 text-sm text-slate-500">Phân ca theo tuần cho nhân viên và giáo viên.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {canEdit && (
            <button onClick={openBulkModal} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Phân ca nhanh
            </button>
          )}
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
        <button onClick={prevWeek} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-900">
            {formatDateShort(monday)} — {formatDateShort(sunday)}/{sunday.getFullYear()}
          </span>
          <button onClick={goToday} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
            Hôm nay
          </button>
        </div>
        <button onClick={nextWeek} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-white p-12 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang tải...
        </div>
      ) : displayUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
          <CalendarDays className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-base font-medium text-slate-900">Chưa có nhân viên</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full min-w-[50rem] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-10 w-44 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nhân viên
                </th>
                {weekDates.map((d, i) => {
                  const dateStr = toDateStr(d);
                  const isToday = dateStr === todayStr;
                  return (
                    <th key={i} className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide ${isToday ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}>
                      {WEEKDAY_LABELS[i]}
                      <div className="mt-0.5 text-[10px] font-normal normal-case">{formatDateShort(d)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayUsers.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top">
                    <div className="text-sm font-medium text-slate-900">{user.name || user.email}</div>
                    <div className="text-xs text-slate-400">{user.role === "teacher" ? "Giáo viên" : "Nhân viên"}</div>
                  </td>
                  {weekDates.map((d, i) => {
                    const dateStr = toDateStr(d);
                    const isToday = dateStr === todayStr;
                    const cellAssignments = getAssignments(user.id, dateStr);
                    const isInlineOpen = inlineCell?.userId === user.id && inlineCell?.date === dateStr;

                    return (
                      <td key={i} className={`px-1.5 py-2 align-top ${isToday ? "bg-blue-50/40" : ""}`}>
                        <div className="space-y-1">
                          {cellAssignments.map((a) => (
                            <div key={a.id} className="group flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1.5 text-xs font-medium text-indigo-800 ring-1 ring-inset ring-indigo-600/20">
                              <span className="flex-1 truncate" title={`${a.shiftName} (${formatTime(a.startTime)}–${formatTime(a.endTime)})`}>
                                {a.shiftName}
                              </span>
                              {canEdit && (
                                <button onClick={() => handleDelete(a.id)} className="hidden flex-shrink-0 text-red-400 hover:text-red-600 group-hover:block" title="Gỡ ca">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Inline assign */}
                          {canEdit && isInlineOpen && (
                            <div className="flex items-center gap-1">
                              <select value={inlineShiftId} onChange={(e) => setInlineShiftId(e.target.value)} className="w-full rounded border-slate-300 px-1 py-1 text-xs focus:border-indigo-500 focus:ring-indigo-500">
                                <option value="">Chọn ca</option>
                                {allShifts.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                              <button onClick={handleInlineAssign} disabled={!inlineShiftId || saving} className="rounded bg-indigo-600 px-1.5 py-1 text-xs text-white disabled:opacity-50">
                                ✓
                              </button>
                              <button onClick={() => setInlineCell(null)} className="rounded px-1 py-1 text-xs text-slate-400 hover:text-slate-600">
                                ✕
                              </button>
                            </div>
                          )}

                          {canEdit && !isInlineOpen && (
                            <button onClick={() => { setInlineCell({ userId: user.id, date: dateStr }); setInlineShiftId(""); }} className="w-full rounded-md border border-dashed border-slate-300 py-1 text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500">
                              +
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk assign modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900">Phân ca nhanh</h3>
              <p className="mt-1 text-sm text-slate-500">Chọn nhân viên, ca, rồi tick các ngày cần phân.</p>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nhân viên *</label>
                <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500">
                  <option value="">-- Chọn nhân viên --</option>
                  {allUsers.filter((u) => u.role !== "admin").map((u) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ca làm việc *</label>
                <select value={assignShiftId} onChange={(e) => setAssignShiftId(e.target.value)} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500">
                  <option value="">-- Chọn ca --</option>
                  {allShifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({formatTime(s.startTime)}–{formatTime(s.endTime)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chọn ngày *</label>
                <div className="grid grid-cols-4 gap-2">
                  {weekDates.map((d, i) => {
                    const dateStr = toDateStr(d);
                    const checked = assignDates.has(dateStr);
                    return (
                      <label key={i} className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm ${checked ? "border-indigo-500 bg-indigo-50 text-indigo-800 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleDate(dateStr)} className="sr-only" />
                        <span>{WEEKDAY_LABELS[i]}</span>
                        <span className="text-xs">{formatDateShort(d)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button onClick={() => setShowAssignModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  Hủy
                </button>
                <button onClick={handleBulkAssign} disabled={!assignUserId || !assignShiftId || assignDates.size === 0 || saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Đang lưu..." : `Phân ${assignDates.size} ngày`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
