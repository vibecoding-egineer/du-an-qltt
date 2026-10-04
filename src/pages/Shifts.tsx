import React, { useEffect, useState } from "react";
import { Plus, Search, Clock, Edit, Trash2, ShieldAlert } from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  isAdministrative: boolean;
}

/** Chuyển "07:30:00" hoặc "07:30" → "07:30" để hiển thị. */
const formatTime = (time: string): string => {
  if (!time) return "";
  const parts = time.split(":");
  return `${parts[0]}:${parts[1]}`;
};

export function Shifts() {
  const { dbUser } = useAuth();
  const userRole = dbUser?.role;
  const hasPermission = userRole === "admin" || (dbUser?.permissions?.includes("/shifts") ?? false);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    startTime: "",
    endTime: "",
    isAdministrative: false,
  });

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/shifts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setShifts(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc muốn xóa ca làm việc này?")) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/shifts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchShifts();
      } else {
        const data = await res.json();
        alert(data.error || "Không thể xóa ca làm việc");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.name.trim()) {
      setFormError("Vui lòng nhập tên ca.");
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      setFormError("Vui lòng chọn giờ bắt đầu và kết thúc.");
      return;
    }
    if (formData.endTime <= formData.startTime) {
      setFormError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = editingId ? `/api/shifts/${editingId}` : "/api/shifts";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingId(null);
        fetchShifts();
      } else {
        const data = await res.json();
        setFormError(data.error || "Có lỗi xảy ra khi lưu ca làm việc");
      }
    } catch (err) {
      console.error(err);
      setFormError("Lỗi kết nối server");
    } finally {
      setSaving(false);
    }
  };

  const openNewModal = () => {
    setFormData({ name: "", startTime: "", endTime: "", isAdministrative: false });
    setEditingId(null);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (shift: Shift) => {
    setFormData({
      name: shift.name,
      startTime: formatTime(shift.startTime),
      endTime: formatTime(shift.endTime),
      isAdministrative: shift.isAdministrative,
    });
    setEditingId(shift.id);
    setFormError("");
    setShowModal(true);
  };

  const filteredShifts = shifts.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (userRole !== "admin" && !hasPermission) {
    return (
      <div className="flex h-full items-center justify-center flex-col text-slate-500 p-8">
        <ShieldAlert className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-xl font-medium text-slate-900">Truy cập bị từ chối</p>
        <p className="mt-2 text-sm">Bạn không có quyền quản lý ca làm việc.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý ca</h1>
        {hasPermission && (
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Tạo ca mới
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm ca..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tên ca
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giờ bắt đầu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Giờ kết thúc
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loại ca
                </th>
                {hasPermission && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? "Không tìm thấy ca nào" : "Chưa có ca làm việc nào. Bấm \"Tạo ca mới\" để bắt đầu."}
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{shift.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-gray-700">
                        <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                        {formatTime(shift.startTime)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-gray-700">
                        <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                        {formatTime(shift.endTime)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {shift.isAdministrative ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Ca hành chính
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Ca thường
                        </span>
                      )}
                    </td>
                    {hasPermission && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openEditModal(shift)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(shift.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tạo / sửa ca */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? "Cập nhật ca làm việc" : "Tạo ca mới"}
              </h2>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên ca *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Vd: Ca sáng, Ca chiều, Ca 1..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bắt đầu từ *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đến *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="isAdministrative"
                  checked={formData.isAdministrative}
                  onChange={(e) =>
                    setFormData({ ...formData, isAdministrative: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isAdministrative" className="text-sm text-gray-700 cursor-pointer">
                  <span className="font-medium">Ca hành chính</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Chỉ chọn nếu ca làm việc thuộc khối hành chính
                  </span>
                </label>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
