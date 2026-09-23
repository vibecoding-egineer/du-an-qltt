import React, { useState, useEffect } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { Save } from "lucide-react";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, refreshSettings } = useSettings();
  const [centerName, setCenterName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (settings) {
      setCenterName(settings.centerName);
      setLogoUrl(settings.logoUrl || "");
    }
  }, [settings]);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Cập nhật Trung tâm</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tên trung tâm</label>
            <input
              type="text"
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              className="mt-1 block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
              placeholder="VD: Eduspace"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700">Logo Trung tâm</label>
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
                    const canvas = document.createElement('canvas');
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
                    const ctx = canvas.getContext('2d');
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
                  <p className="text-sm text-slate-500 mb-2">Xem trước Logo:</p>
                  <img src={logoUrl} alt="Logo Preview" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
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

          <div className="pt-4 flex justify-end gap-3">
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
      </div>
    </div>
  );
}
