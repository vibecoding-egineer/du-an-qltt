/**
 * Appearance — Trang tùy chỉnh giao diện (/settings/appearance)
 *
 * Cho phép admin thay đổi:
 * - Tên trung tâm (hiển thị trên sidebar, dashboard)
 * - Logo trung tâm (upload + resize client-side max 256×256)
 *
 * Logic upload logo chuyển nguyên từ SettingsModal.tsx:
 * FileReader → Image → Canvas resize → dataURL → lưu qua SettingsContext.
 *
 * Sau khi lưu thành công: hiện thông báo inline (không đóng trang).
 */

import React, { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";

export function Appearance() {
  const { settings, updateSettings, refreshSettings } = useSettings();

  const [centerName, setCenterName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /* Đồng bộ state khi settings load xong */
  useEffect(() => {
    if (settings) {
      setCenterName(settings.centerName);
      setLogoUrl(settings.logoUrl || "");
    }
  }, [settings]);

  /* === Lưu tên + logo === */
  const handleSave = async () => {
    if (!centerName.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateSettings(centerName, logoUrl || null);
      await refreshSettings();
      setMessage({ type: "success", text: "Đã lưu thay đổi thành công." });
    } catch (error) {
      console.error("Lỗi cập nhật giao diện:", error);
      setMessage({ type: "error", text: "Lỗi khi cập nhật thông tin." });
    } finally {
      setSaving(false);
    }
  };

  /* === Upload logo — resize về max 256×256 trước khi lưu === */
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(file.type);
        setLogoUrl(dataUrl);
        setMessage(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Tùy chỉnh giao diện
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Thay đổi tên, logo và giao diện hiển thị của trung tâm.
        </p>
      </div>

      {/* ── Form card ── */}
      <div className="max-w-lg space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {/* Tên trung tâm */}
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Tên trung tâm
          </label>
          <input
            type="text"
            value={centerName}
            onChange={(e) => {
              setCenterName(e.target.value);
              setMessage(null);
            }}
            className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            placeholder="VD: Eduspace"
          />
        </div>

        {/* Logo upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Logo Trung tâm
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="mt-1 block w-full text-slate-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {logoUrl && (
            <div className="mt-4 flex items-end gap-4">
              <div>
                <p className="text-sm text-slate-500 mb-2">Xem trước Logo:</p>
                <img
                  src={logoUrl}
                  alt="Logo Preview"
                  className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setLogoUrl("");
                  setMessage(null);
                }}
                className="mb-1 text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Xóa logo
              </button>
            </div>
          )}
        </div>

        {/* Thông báo kết quả */}
        {message && (
          <p
            className={`text-sm ${
              message.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}

        {/* Nút lưu */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !centerName.trim()}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}
