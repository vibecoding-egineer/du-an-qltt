import React, { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Link2Off, UserSearch, X } from "lucide-react";
import { auth } from "../lib/firebase";

export type PendingReason =
  | 'unlinked_face'
  | 'no_active_class'
  | 'no_open_session'
  | 'multiple_open_sessions';

export interface PendingCheckin {
  id: number;
  hanetRecordId: string;
  hanetPersonId: string;
  personName: string | null;
  studentId: number | null;
  studentName: string | null;
  studentCode: string | null;
  candidateClassIds: number[] | null;
  checkinTime: string;
  imageUrl: string | null;
  reason: PendingReason;
  createdAt: string | null;
}

export interface ClassOption {
  id: number;
  name: string;
}

interface StudentSearchResult {
  id: number;
  name: string;
  studentCode: string;
  hanetPersonId: string | null;
}

interface HanetPendingCardProps {
  item: PendingCheckin;
  classes: ClassOption[];
  /** Gọi sau khi dòng này đã được xử lý xong, để trang cha tải lại hàng chờ. */
  onProcessed: () => void;
}

const REASON_LABEL: Record<PendingReason, { text: string; hint: string; tone: string }> = {
  unlinked_face: {
    text: "Khuôn mặt chưa liên kết",
    hint: "Camera nhận ra người này nhưng chưa biết là học viên nào. Chọn đúng học viên để liên kết - từ lần sau hệ thống tự nhận.",
    tone: "bg-amber-50 text-amber-800 ring-amber-600/20",
  },
  no_open_session: {
    text: "Chưa mở phiên điểm danh",
    hint: "Không có lớp nào đang mở phiên lúc học viên quét mặt. Chọn lớp để ghi điểm danh.",
    tone: "bg-sky-50 text-sky-800 ring-sky-600/20",
  },
  multiple_open_sessions: {
    text: "Nhiều lớp cùng mở phiên",
    hint: "Học viên có nhiều lớp đang mở phiên cùng lúc nên hệ thống không tự quyết được. Chọn đúng lớp.",
    tone: "bg-sky-50 text-sky-800 ring-sky-600/20",
  },
  no_active_class: {
    text: "Học viên không còn lớp nào",
    hint: "Học viên này hiện không ghi danh lớp nào đang hoạt động. Thường nên bỏ qua, hoặc xếp lớp trước rồi xử lý lại.",
    tone: "bg-slate-100 text-slate-700 ring-slate-500/20",
  },
};

export function HanetPendingCard({ item, classes, onProcessed }: HanetPendingCardProps) {
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflictStudentId, setConflictStudentId] = useState<number | null>(null);

  // Chỉ dùng cho trường hợp khuôn mặt chưa liên kết học viên nào
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedStudent, setPickedStudent] = useState<StudentSearchResult | null>(null);

  const needsStudentPick = item.studentId === null;
  const reason = REASON_LABEL[item.reason];

  // Tìm học viên theo tên/mã, có độ trễ 300ms để không gọi máy chủ sau mỗi phím gõ.
  useEffect(() => {
    if (!needsStudentPick) return;
    const keyword = studentQuery.trim();
    if (keyword.length < 2) {
      setStudentResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/students/search?q=${encodeURIComponent(keyword)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          setStudentResults(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [studentQuery, needsStudentPick]);

  const handleResolve = async () => {
    // Kiểm tra ngay trên trình duyệt trước khi gửi lên máy chủ
    if (!selectedClassId) {
      setError("Vui lòng chọn lớp để ghi điểm danh.");
      return;
    }
    if (needsStudentPick && !pickedStudent) {
      setError("Vui lòng chọn học viên để liên kết với khuôn mặt này.");
      return;
    }

    setBusy(true);
    setError("");
    setConflictStudentId(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/hanet-pending-checkins/${item.id}/resolve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classId: selectedClassId,
          ...(pickedStudent ? { studentId: pickedStudent.id } : {}),
        }),
      });

      if (res.ok) {
        onProcessed();
      } else {
        const data = await res.json();
        setError(data.error || "Không xử lý được check-in này.");
        // Máy chủ trả về ai đang giữ khuôn mặt -> hiện nút gỡ liên kết ngay tại đây
        // để nhân viên sửa được luôn mà không phải đi tìm ở trang khác.
        if (typeof data.conflictStudentId === "number") {
          setConflictStudentId(data.conflictStudentId);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    setBusy(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/hanet-pending-checkins/${item.id}/dismiss`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onProcessed();
      } else {
        const data = await res.json();
        setError(data.error || "Không bỏ qua được check-in này.");
      }
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setBusy(false);
    }
  };

  const handleUnlinkConflict = async () => {
    if (!conflictStudentId) return;
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/students/${conflictStudentId}/hanet-link`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setError("");
        setConflictStudentId(null);
      } else {
        const data = await res.json();
        setError(data.error || "Không gỡ được liên kết.");
      }
    } catch (err) {
      console.error(err);
      setError("Lỗi kết nối.");
    } finally {
      setBusy(false);
    }
  };

  const candidateIds = item.candidateClassIds ?? [];
  const candidateClasses = classes.filter(c => candidateIds.includes(c.id));
  const otherClasses = classes.filter(c => !candidateIds.includes(c.id));
  const displayName = item.studentName || item.personName || "Không rõ tên";

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Ảnh chụp lúc quét mặt, để nhân viên đối chiếu bằng mắt */}
        <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={`Ảnh check-in của ${displayName}`}
              className="h-full w-full object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
              Không có ảnh
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-900">
                {displayName}
                {item.studentCode && (
                  <span className="ml-2 text-sm font-normal text-slate-500">({item.studentCode})</span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                Quét mặt lúc{" "}
                {new Date(item.checkinTime).toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${reason.tone}`}>
              {reason.text}
            </span>
          </div>

          <p className="text-xs text-slate-500">{reason.hint}</p>

          {/* Chọn học viên - chỉ khi khuôn mặt chưa liên kết với ai */}
          {needsStudentPick && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Học viên <span className="text-red-500">*</span>
              </label>
              {pickedStudent ? (
                <div className="mt-1 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm ring-1 ring-inset ring-blue-600/20">
                  <span className="font-medium text-blue-900">
                    {pickedStudent.name} ({pickedStudent.studentCode})
                  </span>
                  <button
                    type="button"
                    onClick={() => { setPickedStudent(null); setStudentQuery(""); }}
                    className="ml-auto text-blue-600 hover:text-blue-800"
                    title="Chọn lại"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <div className="relative">
                    <UserSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Gõ tên hoặc mã học viên (ít nhất 2 ký tự)..."
                      className="block w-full rounded-md border-0 py-1.5 pl-9 pr-3 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                    )}
                  </div>
                  {studentResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-slate-200">
                      {studentResults.map(s => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => { setPickedStudent(s); setStudentResults([]); setError(""); }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            <span className="text-slate-900">{s.name} <span className="text-slate-500">({s.studentCode})</span></span>
                            {s.hanetPersonId && (
                              <span className="ml-2 text-xs text-amber-700">đã có khuôn mặt</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Chọn lớp để ghi điểm danh */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Ghi điểm danh vào lớp <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => { setSelectedClassId(e.target.value ? parseInt(e.target.value) : ""); setError(""); }}
              className="mt-1 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            >
              <option value="">-- Chọn lớp --</option>
              {candidateClasses.length > 0 && (
                <optgroup label="Lớp học viên đang học">
                  {candidateClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {otherClasses.length > 0 && (
                <optgroup label={candidateClasses.length > 0 ? "Lớp khác" : "Tất cả lớp"}>
                  {otherClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <p>{error}</p>
                {conflictStudentId && (
                  <button
                    type="button"
                    onClick={handleUnlinkConflict}
                    disabled={busy}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Link2Off className="h-3.5 w-3.5" />
                    Gỡ liên kết cũ rồi thử lại
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleResolve}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Ghi điểm danh
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
              title="Bỏ qua mà không tạo điểm danh (nhận nhầm người, khách vãng lai...)"
            >
              <X className="h-4 w-4" />
              Bỏ qua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
