import React, { useEffect, useState } from "react";
import { Plus, Search, Banknote, Edit, Trash2, ShieldAlert } from "lucide-react";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

/* ── Types ── */
interface SalaryTypeRecord {
  id: number;
  name: string;
  type: "fixed" | "percentage" | "per_shift" | "per_hour";
  amount: string; // DECIMAL trả về dạng string
}

/** Option cho dropdown loại lương */
interface TypeOption {
  value: SalaryTypeRecord["type"];
  label: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { value: "fixed", label: "Cố định/tháng" },
  { value: "percentage", label: "% học phí" },
  { value: "per_shift", label: "Theo ca" },
  { value: "per_hour", label: "Theo giờ" },
];

/** Map type → badge style */
const TYPE_BADGE: Record<SalaryTypeRecord["type"], { bg: string; text: string; label: string }> = {
  fixed: { bg: "bg-blue-100", text: "text-blue-800", label: "Cố định/tháng" },
  percentage: { bg: "bg-amber-100", text: "text-amber-800", label: "% học phí" },
  per_shift: { bg: "bg-green-100", text: "text-green-800", label: "Theo ca" },
  per_hour: { bg: "bg-purple-100", text: "text-purple-800", label: "Theo giờ" },
};

/** Format số tiền VND hoặc tỷ lệ % */
function formatAmount(type: SalaryTypeRecord["type"], amount: string): string {
  const num = Number(amount);
  if (isNaN(num)) return amount;
  if (type === "percentage") {
    return `${num}%`;
  }
  // VND: hiển thị dấu chấm phân cách nghìn
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

/** Placeholder gợi ý theo loại lương */
function amountPlaceholder(type: SalaryTypeRecord["type"]): string {
  switch (type) {
    case "fixed":
      return "Vd: 5000000";
    case "percentage":
      return "Vd: 30 (tức 30%)";
    case "per_shift":
      return "Vd: 200000";
    case "per_hour":
      return "Vd: 50000";
  }
}

/** Đơn vị hiển thị bên phải input */
function amountSuffix(type: SalaryTypeRecord["type"]): string {
  switch (type) {
    case "fixed":
      return "₫/tháng";
    case "percentage":
      return "%";
    case "per_shift":
      return "₫/ca";
    case "per_hour":
      return "₫/giờ";
  }
}

export function Payroll() {
  const { dbUser } = useAuth();
  const userRole = dbUser?.role;
  const hasPermission =
    userRole === "admin" || (dbUser?.permissions?.includes("/payroll") ?? false);

  const [records, setRecords] = useState<SalaryTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    type: "fixed" as SalaryTypeRecord["type"],
    amount: "",
  });

  useEffect(() => {
    fetchRecords();
  }, []);

  /* ── API helpers ── */
  const fetchRecords = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/salary-types", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRecords(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc muốn xóa loại lương này?")) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/salary-types/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchRecords();
      } else {
        const data = await res.json();
        alert(data.error || "Không thể xóa loại lương");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    /* ── Client-side validation ── */
    if (!formData.name.trim()) {
      setFormError("Vui lòng nhập tên loại lương.");
      return;
    }
    const parsedAmount = Number(formData.amount);
    if (!formData.amount || isNaN(parsedAmount) || parsedAmount < 0) {
      setFormError("Số tiền/tỷ lệ phải là số không âm.");
      return;
    }
    if (formData.type === "percentage" && parsedAmount > 100) {
      setFormError("Tỷ lệ phần trăm không được vượt quá 100%.");
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const url = editingId ? `/api/salary-types/${editingId}` : "/api/salary-types";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          amount: parsedAmount,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingId(null);
        fetchRecords();
      } else {
        const data = await res.json();
        setFormError(data.error || "Có lỗi xảy ra khi lưu.");
      }
    } catch (err) {
      console.error(err);
      setFormError("Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Modal helpers ── */
  const openNewModal = () => {
    setFormData({ name: "", type: "fixed", amount: "" });
    setEditingId(null);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (record: SalaryTypeRecord) => {
    setFormData({
      name: record.name,
      type: record.type,
      amount: String(Number(record.amount)),
    });
    setEditingId(record.id);
    setFormError("");
    setShowModal(true);
  };

  /* ── Filter ── */
  const filteredRecords = records.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  /* ── RBAC guard ── */
  if (userRole !== "admin" && !hasPermission) {
    return (
      <div className="flex h-full items-center justify-center flex-col text-slate-500 p-8">
        <ShieldAlert className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-xl font-medium text-slate-900">Truy cập bị từ chối</p>
        <p className="mt-2 text-sm">Bạn không có quyền quản lý bảng lương.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý loại lương</h1>
        {hasPermission && (
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Thêm loại lương
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm loại lương..."
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
                  Tên loại lương
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hình thức
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mức lương / Tỷ lệ
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
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery
                      ? "Không tìm thấy loại lương nào"
                      : 'Chưa có loại lương nào. Bấm "Thêm loại lương" để bắt đầu.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const badge = TYPE_BADGE[record.type];
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900">{record.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
                        {formatAmount(record.type, record.amount)}
                      </td>
                      {hasPermission && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openEditModal(record)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tạo / sửa loại lương */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? "Cập nhật loại lương" : "Thêm loại lương mới"}
              </h2>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}

              {/* Tên loại lương */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên loại lương *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Vd: Lương cơ bản, Hoa hồng..."
                />
              </div>

              {/* Hình thức lương */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hình thức *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as SalaryTypeRecord["type"],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mức lương / tỷ lệ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.type === "percentage" ? "Tỷ lệ *" : "Mức lương *"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    max={formData.type === "percentage" ? 100 : undefined}
                    step="any"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={amountPlaceholder(formData.type)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                    {amountSuffix(formData.type)}
                  </span>
                </div>
                {formData.type === "percentage" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Tỷ lệ phần trăm tính trên tổng học phí thu được (0 - 100%)
                  </p>
                )}
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
                  {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
