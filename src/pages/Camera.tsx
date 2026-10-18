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

import React, { useState } from "react";
import {
  Camera as CameraIcon,
  Save,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Loader2,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { useSettings } from "../contexts/SettingsContext";

export function Camera() {
  const { settings, refreshSettings } = useSettings();

  const [secretInput, setSecretInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savingSecret, setSavingSecret] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const hasHanetSecret = Boolean(settings?.hasHanetSecret);

  /* ══════════════════════════════════════════════════════════
     Handlers
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
    </div>
  );
}
