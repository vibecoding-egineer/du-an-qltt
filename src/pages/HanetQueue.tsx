import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { auth } from "../lib/firebase";
import { HanetPendingCard, type PendingCheckin, type ClassOption } from "../components/HanetPendingCard";

export function HanetQueue() {
  const [items, setItems] = useState<PendingCheckin[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  /**
   * @param silent true = làm mới ngầm, không hiện màn hình tải (dùng khi bấm nút Làm mới
   *               hoặc sau khi xử lý xong một dòng, để danh sách không bị nháy).
   */
  const fetchQueue = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [queueRes, classesRes] = await Promise.all([
        fetch("/api/hanet-pending-checkins", { headers }),
        fetch("/api/classes", { headers }),
      ]);

      if (!queueRes.ok) {
        const data = await queueRes.json();
        setError(data.error || "Không tải được hàng chờ check-in.");
        return;
      }

      setItems(await queueRes.json());
      if (classesRes.ok) {
        setClasses(await classesRes.json());
      }
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Check-in chờ xử lý</h2>
          <p className="mt-1 text-sm text-slate-500">
            Các lượt quét mặt từ camera mà hệ thống chưa tự xác định được lớp. Chọn đúng lớp để
            ghi điểm danh, hoặc bỏ qua nếu nhận nhầm người.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && items.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
              {items.length} lượt chờ
            </span>
          )}
          <button
            onClick={() => fetchQueue(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => fetchQueue()} className="font-medium text-red-600 hover:text-red-800">
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-white p-12 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" />
          Đang tải hàng chờ...
        </div>
      ) : items.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="mt-3 text-base font-medium text-slate-900">Không có check-in nào chờ xử lý</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Mọi lượt quét mặt đều đã được ghi điểm danh tự động. Nếu học viên quét mặt mà không
            thấy vào lớp, hãy kiểm tra xem lớp đó đã mở phiên điểm danh chưa.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <HanetPendingCard
              key={item.id}
              item={item}
              classes={classes}
              onProcessed={() => fetchQueue(true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
