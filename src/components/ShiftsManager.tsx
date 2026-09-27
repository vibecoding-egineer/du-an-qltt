import React, { useCallback, useEffect, useState } from "react";
import { Plus, Clock, Pencil, Trash2, AlertCircle, Loader2, X } from "lucide-react";
import { auth } from "../lib/firebase";

interface Shift {
  id: number;
  name: string;
  startTime: string;  // "07:30:00"
  endTime: string;    // "11:30:00"
  isAdministrative: boolean;
}

interface ShiftFormData {
  name: string;
  startTime: string;  // "07:30" - dạng hiển thị trên ô input type="time"
  endTime: string;
  isAdministrative: boolean;
}

const EMPTY_FORM: ShiftFormData = {
  name: "",
  startTime: "",
  endTime: "",
  isAdministrative: false,
};

/** Máy chủ trả về "07:30:00", còn ô input type="time" cần "07:30". */
function toInputTime(value: string): string {
  return value ? value.slice(0, 5) : "";
}

/** Tính độ dài ca để hiển thị, ví dụ "4h", "1h30". */
function formatDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}

export function ShiftsManager() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState<ShiftFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/shifts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShifts(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Không tải được danh sách ca.");
      }
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const openCreate = () => {
    setEditingShift(null);
    setFormData(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      startTime: toInputTime(shift.startTime),
      endTime: toInputTime(shift.endTime),
      isAdministrative: shift.isAdministrative,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Kiểm tra ngay trên trình duyệt trước khi gửi, để người dùng biết lỗi tức thì.
    // Máy chủ vẫn kiểm tra lại - đây chỉ là lớp tiện lợi, không phải lớp bảo vệ.
    if (!formData.name.trim()) {
      setFormError("Vui lòng nhập tên ca.");
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      setFormError("Vui lòng chọn giờ bắt đầu và giờ kết thúc.");
      return;
    }
    if (formData.endTime <= formData.startTime) {
      setFormError("Giờ kết thúc phải sau giờ bắt đầu. Hệ thống chưa hỗ trợ ca qua đêm.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = editingShift ? `/api/shifts/${editingShift.id}` : "/api/shifts";
      const res = await fetch(url, {
        method: editingShift ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
        fetchShifts();
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || "Lưu thất bại. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error(err);
      setFormError("Lỗi kết nối.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/shifts/${confirmDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConfirmDelete(null);
        fetchShifts();
      } else {
        const data = await res.json().catch(() => ({}));
        // Máy chủ chặn xóa khi ca đang được dùng và nói rõ vướng ở đâu - hiện nguyên văn
        // thông báo đó để người dùng biết phải gỡ gì trước.
        setDeleteError(data.error || "Xóa thất bại.");
      }
    } catch (err) {
      console.error(err);
      setDeleteError("Lỗi kết nối.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Ca làm việc</h3>
          <p className="mt-1 text-sm text-slate-500">
            Khung giờ dùng chung cho thời khóa biểu lớp học và phân ca nhân viên.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Tạo ca
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={fetchShifts} className="font-medium text-red-600 hover:text-red-800">
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-white p-12 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          Đang tải...
        </div>
      ) : shifts.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
          <Clock className="h-10 w-10 text-slate-300" />
          <p className="mt-3 text-base font-medium text-slate-900">Chưa có ca nào</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Tạo các ca như "Ca sáng 07:30-11:30", "Ca chiều 13:30-17:30" để dùng khi xếp
            thời khóa biểu và phân ca cho nhân viên.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shifts.map((shift) => (
            <div key={shift.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">{shift.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <Clock className="h-4 w-4 text-slate-400" />
                    {toInputTime(shift.startTime)} – {toInputTime(shift.endTime)}
                    <span className="text-slate-400">
                      ({formatDuration(shift.startTime, shift.endTime)})
                    </span>
                  </div>
                  {shift.isAdministrative && (
                    <span className="mt-2 inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-600/20">
                      Ca hành chính
                    </span>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(shift)}
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Sửa"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setDeleteError(""); setConfirmDelete(shift); }}
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {editingShift ? "Sửa ca làm việc" : "Tạo ca làm việc"}
            </h3>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Tên ca <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Ca sáng, Ca chiều, Ca 1"
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Kết thúc <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={formData.isAdministrative}
                  onChange={(e) => setFormData({ ...formData, isAdministrative: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span className="text-sm text-slate-700">
                  Ca hành chính
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Chỉ để phân nhóm khi hiển thị, không ảnh hưởng cách tính công.
                  </span>
                </span>
              </label>

              {formError && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingShift ? "Lưu thay đổi" : "Tạo ca"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Xóa ca làm việc</h3>
            <p className="mt-2 text-sm text-slate-600">
              Xóa ca <span className="font-medium text-slate-900">{confirmDelete.name}</span>{" "}
              ({toInputTime(confirmDelete.startTime)} – {toInputTime(confirmDelete.endTime)})?
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Nếu ca này đang được dùng trong thời khóa biểu hoặc bảng công, hệ thống sẽ
              từ chối và cho biết cần gỡ ở đâu trước.
            </p>

            {deleteError && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
