import React, { useState, useEffect } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { auth } from "../lib/firebase";
import {
  Save,
  Camera,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Loader2,
} from "lucide-react";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, refreshSettings } = useSettings();
  const [centerName, setCenterName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  /* --- Hanet secret state --- */
  const [secretInput, setSecretInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savingSecret, setSavingSecret] = useState(false);
  const [secretMessage, setSecretMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (settings) {
      setCenterName(settings.centerName);
      setLogoUrl(settings.logoUrl || "");
    }
  }, [settings]);

  /*
   * hasHanetSecret được trả về từ GET /api/settings.
   * Nếu TypeScript báo lỗi, thêm `hasHanetSecret?: boolean` vào
   * interface Settings trong SettingsContext.
   */
  const hasHanetSecret = Boolean(settings?.hasHanetSecret);

  /* === Lưu tên + logo (route cũ) === */

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings(centerName, logoUrl || null);
      await refreshSettings();
      onClose();
    } catch (error) {
      alert("Lỗi khi cập nhật thông tin");
    } finally {
      setSavingSettings(false);
    }
  };

  /* === Lưu / Xóa Hanet secret (route riêng) === */

  const handleSaveSecret = async () => {
    if (!secretInput.trim()) return;
    setSavingSecret(true);
    setSecretMessage(null);
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
        const data: Record<string, string> = await res.json().catch(() => ({}));
        throw new Error(data.error || "Lỗi cập nhật");
      }
      setSecretInput("");
      setShowSecret(false);
      setSecretMessage({
        type: "success",
        text: "Đã lưu Client Secret thành công.",
      });
      await refreshSettings();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Lỗi không xác định";
      setSecretMessage({ type: "error", text: message });
    } finally {
      setSavingSecret(false);
    }
  };

  const handleRemoveSecret = async () => {
    if (!confirm("Xóa Client Secret sẽ ngắt kết nối camera Hanet. Bạn có chắc?"))
      return;
    setSavingSecret(true);
    setSecretMessage(null);
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
        const data: Record<string, string> = await res.json().catch(() => ({}));
        throw new Error(data.error || "Lỗi xóa cấu hình");
      }
      setSecretInput("");
      setSecretMessage({ type: "success", text: "Đã xóa Client Secret." });
      await refreshSettings();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Lỗi không xác định";
      setSecretMessage({ type: "error", text: message });
    } finally {
      setSavingSecret(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* ===== Header ===== */}
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">
            Cập nhật Trung tâm
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* ===== Phần 1: Tên + Logo ===== */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Tên trung tâm
              </label>
              <input
                type="text"
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                placeholder="VD: Eduspace"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Logo Trung tâm
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    alert("Vui lòng chọn ảnh nhỏ hơn 2MB");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement("canvas");
                      const MAX_WIDTH = 256;
                      const MAX_HEIGHT = 256;
                      let width = img.width;
                      let height = img.height;

                      if (width > height) {
                        if (width > MAX_WIDTH) {
                          height = Math.round((height *= MAX_WIDTH / width));
                          width = MAX_WIDTH;
                        }
                      } else {
                        if (height > MAX_HEIGHT) {
                          width = Math.round((width *= MAX_HEIGHT / height));
                          height = MAX_HEIGHT;
                        }
                      }

                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext("2d");
                      ctx?.drawImage(img, 0, 0, width, height);

                      const dataUrl = canvas.toDataURL(file.type);
                      setLogoUrl(dataUrl);
                    };
                    img.src = event.target?.result as string;
                  };
                  reader.readAsDataURL(file);
                }}
                className="mt-1 block w-full text-slate-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {logoUrl && (
                <div className="mt-4 flex items-end gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-2">
                      Xem trước Logo:
                    </p>
                    <img
                      src={logoUrl}
                      alt="Logo Preview"
                      className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="mb-1 text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Xóa logo
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings || !centerName}
                className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingSettings ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>

          {/* ===== Divider ===== */}
          <div className="border-t border-slate-200" />

          {/* ===== Phần 2: Camera Hanet AI ===== */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-slate-500" />
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
                  setSecretMessage(null);
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
            {secretMessage && (
              <p
                className={`text-xs ${
                  secretMessage.type === "success"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {secretMessage.text}
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
        </div>
      </div>
    </div>
  );
}
