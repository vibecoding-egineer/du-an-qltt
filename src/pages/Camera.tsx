/**
 * Camera — Trang cấu hình Camera Hanet AI (/settings/camera)
 *
 * Cho phép admin:
 * - Nhập / thay đổi Client Secret từ Hanet
 * - Xóa Client Secret (ngắt kết nối camera)
 * - Xem trạng thái cấu hình (Đã cấu hình / Chưa cấu hình)
 *
 * Logic chuyển nguyên từ SettingsModal.tsx:
 * - PUT /api/settings/hanet-secret (lưu hoặc xóa)
 * - refreshSettings() sau khi thao tác thành công
 * - hasHanetSecret từ useSettings() context
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Camera as CameraIcon,
  Save,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Loader2,
  Plus,
  MapPin,
  Pencil,
  Link2,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { useSettings } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface CameraDeviceMapping {
  id: number;
  tenantId: string;
  branchId: number;
  placeId: string | null;
  placeName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  createdAt: string | null;
  branchName: string | null;
  branchCode: string | null;
}

export function Camera() {
  const { settings, refreshSettings } = useSettings();
  const { dbUser } = useAuth();
  const isAdmin = dbUser?.role === "admin";

  // --- Secret state ---
  const [secretInput, setSecretInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savingSecret, setSavingSecret] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const hasHanetSecret = Boolean(settings?.hasHanetSecret);

  // --- Camera mapping state ---
  const [mappings, setMappings] = useState<CameraDeviceMapping[]>([]);
  const [mappingLoading, setMappingLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CameraDeviceMapping | null>(null);
  const [mappingForm, setMappingForm] = useState({
    placeName: "",
    deviceId: "",
    deviceName: "",
    branchId: "",
  });
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingMessage, setMappingMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /* ══════════════════════════════════════════════════════════
     Fetch camera mappings & branches
     ══════════════════════════════════════════════════════════ */

  const fetchMappings = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/camera-devices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: CameraDeviceMapping[] = await res.json();
        setMappings(data);
      }
    } catch (err: unknown) {
      console.error("Lỗi tải mapping camera:", err);
    } finally {
      setMappingLoading(false);
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/branches", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Branch[] = await res.json();
        setBranches(data);
      }
    } catch (err: unknown) {
      console.error("Lỗi tải danh sách cơ sở:", err);
    }
  }, []);

  useEffect(() => {
    fetchMappings();
    fetchBranches();
  }, [fetchMappings, fetchBranches]);

  /* ══════════════════════════════════════════════════════════
     Handlers — Secret
     ══════════════════════════════════════════════════════════ */

  const handleSaveSecret = async () => {
    if (!secretInput.trim()) return;
    setSavingSecret(true);
    setMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/settings/hanet-secret", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientSecret: secretInput.trim() }),
      });
      if (!res.ok) {
        const data: Record<string, string> = await res
          .json()
          .catch(() => ({}));
        throw new Error(data.error || "Lỗi cập nhật");
      }
      setSecretInput("");
      setShowSecret(false);
      setMessage({
        type: "success",
        text: "Đã lưu Client Secret thành công.",
      });
      await refreshSettings();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Lỗi không xác định";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSavingSecret(false);
    }
  };

  const handleRemoveSecret = async () => {
    if (
      !confirm("Xóa Client Secret sẽ ngắt kết nối camera Hanet. Bạn có chắc?")
    )
      return;
    setSavingSecret(true);
    setMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/settings/hanet-secret", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientSecret: "" }),
      });
      if (!res.ok) {
        const data: Record<string, string> = await res
          .json()
          .catch(() => ({}));
        throw new Error(data.error || "Lỗi xóa cấu hình");
      }
      setSecretInput("");
      setMessage({ type: "success", text: "Đã xóa Client Secret." });
      await refreshSettings();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Lỗi không xác định";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSavingSecret(false);
    }
  };

  /* ══════════════════════════════════════════════════════════
     Handlers — Camera Mapping
     ══════════════════════════════════════════════════════════ */

  const openAddMappingModal = () => {
    setEditingMapping(null);
    setMappingForm({ placeName: "", deviceId: "", deviceName: "", branchId: "" });
    setMappingMessage(null);
    setShowMappingModal(true);
  };

  const openEditMappingModal = (mapping: CameraDeviceMapping) => {
    setEditingMapping(mapping);
    setMappingForm({
      placeName: mapping.placeName || "",
      deviceId: mapping.deviceId || "",
      deviceName: mapping.deviceName || "",
      branchId: String(mapping.branchId),
    });
    setMappingMessage(null);
    setShowMappingModal(true);
  };

  const handleSaveMapping = async () => {
    const trimmedPlaceName = mappingForm.placeName.trim();
    const trimmedDeviceId = mappingForm.deviceId.trim();

    if (!trimmedPlaceName && !trimmedDeviceId) {
      setMappingMessage({ type: "error", text: "Phải nhập ít nhất Tên địa điểm hoặc Serial camera." });
      return;
    }
    if (!mappingForm.branchId) {
      setMappingMessage({ type: "error", text: "Vui lòng chọn cơ sở." });
      return;
    }

    setMappingSaving(true);
    setMappingMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const isEdit = editingMapping !== null;

      const trimmedDeviceName = mappingForm.deviceName.trim();

      const body = {
        placeName: trimmedPlaceName || null,
        deviceId: trimmedDeviceId || null,
        deviceName: trimmedDeviceName || null,
        branchId: mappingForm.branchId,
      };

      const url = isEdit
        ? `/api/camera-devices/${editingMapping.id}`
        : "/api/camera-devices";

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data: Record<string, string> = await res.json().catch(() => ({}));
        throw new Error(data.error || "Lỗi lưu mapping");
      }

      setShowMappingModal(false);
      await fetchMappings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Lỗi không xác định";
      setMappingMessage({ type: "error", text: errorMessage });
    } finally {
      setMappingSaving(false);
    }
  };

  const handleDeleteMapping = async (mappingId: number) => {
    if (!confirm("Xóa mapping này? Camera sẽ không tự gắn vào cơ sở nữa.")) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/camera-devices/${mappingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data: Record<string, string> = await res.json().catch(() => ({}));
        throw new Error(data.error || "Lỗi xóa mapping");
      }
      await fetchMappings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Lỗi không xác định";
      alert(errorMessage);
    }
  };

  /* ══════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Camera</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cấu hình kết nối camera Hanet AI để điểm danh tự động.
        </p>
      </div>

      {/* ── Card cấu hình ── */}
      <div className="max-w-lg space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {/* Tiêu đề + badge trạng thái */}
        <div className="flex items-center gap-2">
          <CameraIcon className="h-5 w-5 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-900">
            Camera Hanet AI
          </h4>
          {hasHanetSecret ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              <ShieldCheck className="h-3 w-3" />
              Đã cấu hình
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              <ShieldAlert className="h-3 w-3" />
              Chưa cấu hình
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Nhập Client Secret từ trang quản trị Hanet để kết nối camera điểm
          danh tự động. Secret chỉ lưu một lần, không hiển thị lại.
        </p>

        {/* Input secret */}
        <div className="relative">
          <input
            type={showSecret ? "text" : "password"}
            value={secretInput}
            onChange={(e) => {
              setSecretInput(e.target.value);
              setMessage(null);
            }}
            placeholder={
              hasHanetSecret
                ? "••••••••  (nhập mới để thay đổi)"
                : "Dán Client Secret vào đây"
            }
            className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
          />
          <button
            type="button"
            onClick={() => setShowSecret((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            title={showSecret ? "Ẩn" : "Hiện"}
          >
            {showSecret ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Thông báo kết quả */}
        {message && (
          <p
            className={`text-xs ${
              message.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveSecret}
            disabled={savingSecret || !secretInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {savingSecret ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {savingSecret ? "Đang lưu..." : "Lưu Secret"}
          </button>

          {hasHanetSecret && (
            <button
              onClick={handleRemoveSecret}
              disabled={savingSecret}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Xóa cấu hình
            </button>
          )}
        </div>
      </div>
      {/* ── Camera Mapping Section ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Gắn camera vào cơ sở
            </h3>
            <p className="text-sm text-slate-500">
              Gắn camera vào cơ sở bằng Tên địa điểm hoặc Serial camera (xem
              trong app Hanet Connect). Khi camera gửi check-in, hệ thống tự
              biết thuộc cơ sở nào.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openAddMappingModal}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm mapping
            </button>
          )}
        </div>

        {mappingLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải...
          </div>
        ) : mappings.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <Link2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              Chưa có mapping nào. Thêm mapping để gắn camera Hanet với cơ sở.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    placeName
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Serial camera
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Tên thiết bị
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Cơ sở
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                      Thao tác
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mappings.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {m.placeName || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.deviceId ? (
                        <div className="text-sm text-slate-700">
                          {m.deviceId}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                          Tất cả camera
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-700">
                        {m.deviceName || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {m.branchName || `Cơ sở #${m.branchId}`}
                        </span>
                        {m.branchCode && (
                          <span className="text-xs text-slate-400">
                            ({m.branchCode})
                          </span>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditMappingModal(m)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="Sửa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMapping(m.id)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Xóa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Thêm/Sửa Mapping ── */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {editingMapping ? "Sửa mapping camera" : "Thêm mapping camera"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {editingMapping
                ? "Cập nhật thông tin mapping hoặc đổi cơ sở."
                : "Gắn camera vào cơ sở bằng Tên địa điểm hoặc Serial camera."}
            </p>

            <div className="mt-4 space-y-3">
              {/* placeName */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  placeName
                </label>
                <input
                  type="text"
                  value={mappingForm.placeName}
                  onChange={(e) =>
                    setMappingForm((prev) => ({ ...prev, placeName: e.target.value }))
                  }
                  placeholder="VD: trung kính"
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Điền giống địa điểm trong app Hanet
                </p>
              </div>

              {/* Serial camera (Device ID) */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Serial camera
                </label>
                <input
                  type="text"
                  value={mappingForm.deviceId}
                  onChange={(e) =>
                    setMappingForm((prev) => ({ ...prev, deviceId: e.target.value }))
                  }
                  placeholder="VD: V21443M409"
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Xem serial trên thân camera hoặc trong app Hanet Connect. Để
                  trống = áp dụng tất cả camera tại địa điểm.
                </p>
              </div>

              {/* Tên thiết bị */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tên thiết bị
                </label>
                <input
                  type="text"
                  value={mappingForm.deviceName}
                  onChange={(e) =>
                    setMappingForm((prev) => ({ ...prev, deviceName: e.target.value }))
                  }
                  placeholder="VD: Camera cổng chính"
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Đặt tên gợi nhớ cho camera, VD: Camera cổng chính
                </p>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Cơ sở <span className="text-red-500">*</span>
                </label>
                <select
                  value={mappingForm.branchId}
                  onChange={(e) =>
                    setMappingForm((prev) => ({ ...prev, branchId: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">— Chọn cơ sở —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Thông báo lỗi */}
            {mappingMessage && (
              <p
                className={`mt-3 text-xs ${
                  mappingMessage.type === "success"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {mappingMessage.text}
              </p>
            )}

            {/* Buttons */}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowMappingModal(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={mappingSaving}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {mappingSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {mappingSaving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
