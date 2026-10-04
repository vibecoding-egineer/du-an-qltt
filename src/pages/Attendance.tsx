import React, { useCallback, useEffect, useRef, useState } from "react";
import { Save, AlertCircle, Camera, Square, Loader2 } from "lucide-react";
import { auth } from "../lib/firebase";

interface Student {
  id: number;
  name: string;
  studentCode: string;
}

interface ClassData {
  id: number;
  name: string;
  branchId: number;
  teacherId: number | null;
}

interface StaffOption {
  id: number;
  name: string | null;
  email: string;
  role: string | null;
}

interface AttendanceRecord {
  id?: number;
  studentId: number;
  classId: number;
  date: string;
  status: string; // 'present', 'absent_with_permission', 'absent_without_permission'
  homeworkCompleted: number; // 0: No, 1: Yes
  note?: string;
}

interface AttendanceSession {
  id: number;
  classId: number;
  openedBy: number;
  openedAt: string;
  closedAt: string | null;
}

// Khoảng thời gian tự làm mới danh sách khi đang mở phiên camera, để giáo viên thấy học viên
// hiện lên dần khi các em quét mặt mà không phải tự bấm tải lại.
const AUTO_REFRESH_MS = 30000;

export function Attendance() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<number, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  // --- Phiên điểm danh bằng camera Hanet ---
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // --- Ghi nhận giáo viên đứng lớp ---
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [taughtBy, setTaughtBy] = useState<number | "">("");

  // Ghi nhớ những học viên mà người dùng đã tự chỉnh nhưng CHƯA lưu.
  // Khi tự làm mới, dữ liệu từ máy chủ sẽ KHÔNG ghi đè lên các ô này - nếu không, giáo viên
  // đang sửa dở mà đúng lúc làm mới thì công sức nhập tay bị mất trắng.
  // Dùng useRef thay vì useState vì giá trị này cần đọc được ngay trong hàm làm mới mà không
  // muốn nó kích hoạt vẽ lại giao diện.
  const unsavedStudentIds = useRef<Set<number>>(new Set());

  const isViewingToday = attendanceDate === new Date().toISOString().split('T')[0];

  const fetchClasses = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/classes", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Tải danh sách học viên và điểm danh.
   * @param silent true = làm mới ngầm (không hiện vòng xoay, giữ nguyên các ô người dùng
   *               đang sửa dở). Dùng cho việc tự làm mới khi phiên camera đang mở.
   */
  /** Danh sách nhân sự để chọn người đứng lớp. Tải một lần, dùng lại cho mọi lớp. */
  const fetchStaff = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setStaffOptions(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchStudentsAndAttendance = useCallback(async (classId: number, date: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const [studentsRes, attendanceRes] = await Promise.all([
        fetch(`/api/students?classId=${classId}`, { headers }),
        fetch(`/api/attendance?classId=${classId}&date=${date}`, { headers })
      ]);
      
      if (studentsRes.ok && attendanceRes.ok) {
        const studentsData = await studentsRes.json();
        const attendanceData = await attendanceRes.json();
        
        setStudents(studentsData);
        
        const serverMap: Record<number, AttendanceRecord> = {};
        attendanceData.forEach((record: AttendanceRecord) => {
          serverMap[record.studentId] = record;
        });

        setAttendance(prev => {
          // Tải lần đầu / đổi lớp / đổi ngày: lấy nguyên dữ liệu máy chủ.
          if (!silent) return serverMap;

          // Làm mới ngầm: giữ lại những ô người dùng đang sửa dở, chỉ cập nhật phần còn lại.
          const merged: Record<number, AttendanceRecord> = { ...serverMap };
          unsavedStudentIds.current.forEach(studentId => {
            const localRecord = prev[studentId];
            if (localRecord) merged[studentId] = localRecord;
          });
          return merged;
        });

        if (silent) setLastRefreshedAt(new Date());
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  /** Hỏi máy chủ xem lớp này có phiên điểm danh nào đang mở không. */
  const fetchActiveSession = useCallback(async (classId: number) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/attendance-sessions?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: AttendanceSession[] = await res.json();
        setActiveSession(data.length > 0 ? data[0] : null);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    if (selectedClass) {
      // Điền sẵn giáo viên phụ trách của lớp. Người dùng đổi được khi có dạy thay -
      // đây chỉ là gợi ý mặc định cho trường hợp thường gặp nhất.
      const cls = classes.find(c => c.id === selectedClass);
      setTaughtBy(cls?.teacherId ?? "");

      // Đổi lớp hoặc đổi ngày -> dữ liệu đang sửa dở không còn liên quan nữa.
      unsavedStudentIds.current.clear();
      setLastRefreshedAt(null);
      fetchStudentsAndAttendance(selectedClass, attendanceDate);
      fetchActiveSession(selectedClass);
    }
  }, [selectedClass, attendanceDate, classes, fetchStudentsAndAttendance, fetchActiveSession]);

  // Tự làm mới khi phiên camera đang mở, để học viên quét mặt xong là hiện lên dần.
  // Chỉ chạy khi đang xem ngày hôm nay - xem lại ngày cũ thì không có gì để cập nhật.
  // Mỗi vòng cũng hỏi lại trạng thái phiên, nhờ đó nếu phiên hết hạn (quá 3 tiếng) thì
  // giao diện tự quay về trạng thái "chưa mở", không cần tải lại trang.
  useEffect(() => {
    if (!activeSession || !selectedClass || !isViewingToday) return;

    const timer = setInterval(() => {
      fetchStudentsAndAttendance(selectedClass, attendanceDate, true);
      fetchActiveSession(selectedClass);
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
  }, [activeSession?.id, selectedClass, attendanceDate, isViewingToday, fetchStudentsAndAttendance, fetchActiveSession]);

  const openSession = async () => {
    if (!selectedClass) return;
    setSessionBusy(true);
    setSessionError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/attendance-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ classId: selectedClass, taughtBy: taughtBy || null })
      });
      const data = await res.json();
      if (res.ok) {
        setActiveSession(data);
      } else {
        setSessionError(data.error || "Không mở được phiên điểm danh");
      }
    } catch (err) {
      console.error(err);
      setSessionError("Lỗi kết nối");
    } finally {
      setSessionBusy(false);
    }
  };

  const closeSession = async () => {
    if (!activeSession) return;
    setSessionBusy(true);
    setSessionError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/attendance-sessions/${activeSession.id}/close`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setActiveSession(null);
        // Lấy lại lần cuối để không bỏ sót em nào vừa quét mặt ngay trước khi đóng phiên.
        if (selectedClass) await fetchStudentsAndAttendance(selectedClass, attendanceDate, true);
      } else {
        const data = await res.json();
        setSessionError(data.error || "Không kết thúc được phiên điểm danh");
      }
    } catch (err) {
      console.error(err);
      setSessionError("Lỗi kết nối");
    } finally {
      setSessionBusy(false);
    }
  };

  const handleUpdateAttendance = (studentId: number, field: keyof AttendanceRecord, value: any) => {
    if (!selectedClass) return;

    // Đánh dấu ô này đang sửa dở để lần tự làm mới tới không ghi đè lên.
    unsavedStudentIds.current.add(studentId);
    
    setAttendance(prev => {
      const current = prev[studentId] || {
        studentId,
        classId: selectedClass,
        date: attendanceDate,
        status: 'present',
        homeworkCompleted: 0
      };
      
      return {
        ...prev,
        [studentId]: { ...current, [field]: value }
      };
    });
  };

  const markAllStatus = (status: string) => {
    if (!selectedClass) return;
    const newAttendance = { ...attendance };
    students.forEach(student => {
      // Thao tác hàng loạt cũng là sửa tay -> bảo vệ khỏi bị ghi đè khi tự làm mới.
      unsavedStudentIds.current.add(student.id);
      const current = newAttendance[student.id] || {
        studentId: student.id,
        classId: selectedClass,
        date: attendanceDate,
        homeworkCompleted: 0
      };
      newAttendance[student.id] = { ...current, status };
    });
    setAttendance(newAttendance);
  };

  const saveAttendance = async () => {
    if (!selectedClass) return;
    setSaving(true);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const recordsToSave = students.map(student => {
        const record = attendance[student.id];
        return record || {
          studentId: student.id,
          classId: selectedClass,
          date: attendanceDate,
          status: 'present',
          homeworkCompleted: 0,
          note: ''
        };
      });

      const promises = recordsToSave.map(record => 
        fetch("/api/attendance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(record)
        })
      );
      
      await Promise.all(promises);

      // Ghi nhận buổi dạy. Gọi MỘT lần sau khi lưu xong, không gọi trong vòng lặp từng
      // học viên - nếu gọi lặp thì nhiều request đồng thời có thể cùng thấy "chưa có bản ghi"
      // rồi cùng tạo, sinh ra bản ghi trùng cho cùng một buổi.
      // Máy chủ tạo bản ghi ở trạng thái ĐÃ ĐÓNG nên không ảnh hưởng tới điểm danh camera.
      // Lỗi ở bước này không làm hỏng việc lưu điểm danh (đã xong ở trên), nên chỉ ghi log.
      try {
        await fetch("/api/attendance-sessions/manual", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            classId: selectedClass,
            date: attendanceDate,
            taughtBy: taughtBy || null,
          })
        });
      } catch (err) {
        console.error("Không ghi nhận được buổi dạy:", err);
      }

      // Đã lưu xong -> dữ liệu trên máy chủ khớp với màn hình, không còn gì cần bảo vệ
      // khỏi việc ghi đè nữa.
      unsavedStudentIds.current.clear();
      alert("Đã lưu điểm danh thành công!");
    } catch (err) {
      console.error(err);
      alert("Lỗi khi lưu điểm danh.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Điểm danh Học viên</h2>
          <p className="mt-1 text-sm text-slate-500">
            Điểm danh và kiểm tra bài tập về nhà theo từng lớp học.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Ngày:</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            />
          </div>
          {classes.length > 0 && (
            <select
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(parseInt(e.target.value))}
              className="rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          
          {/* Giáo viên đứng lớp buổi này. Điền sẵn giáo viên phụ trách, đổi được khi có
              dạy thay. Giá trị này được ghi lại cả khi mở phiên camera lẫn khi lưu điểm
              danh tay, nên lớp nào cũng có dữ liệu ai dạy buổi nào. */}
          {selectedClass && (
            <div className="flex items-center gap-2">
              <label className="whitespace-nowrap text-sm text-slate-600">Giáo viên dạy:</label>
              <select
                value={taughtBy}
                onChange={(e) => setTaughtBy(e.target.value ? parseInt(e.target.value) : "")}
                title="Người thực tế đứng lớp buổi này"
                className="rounded-md border-0 py-1.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
              >
                <option value="">-- Chưa xác định --</option>
                {staffOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.email}</option>
                ))}
              </select>
            </div>
          )}

          {/* Điểm danh bằng camera Hanet: mở phiên để hệ thống biết check-in thuộc lớp nào.
              Chỉ cho thao tác khi đang xem ngày hôm nay - mở phiên cho ngày quá khứ là vô nghĩa. */}
          {selectedClass && isViewingToday && (
            activeSession ? (
              <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-1.5 ring-1 ring-inset ring-green-600/20">
                <span className="relative flex h-2.5 w-2.5" title="Camera đang nhận điểm danh">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
                </span>
                <div className="text-sm leading-tight">
                  <div className="font-medium text-green-800">Đang điểm danh bằng camera</div>
                  <div className="text-xs text-green-700">
                    Mở lúc {new Date(activeSession.openedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    {lastRefreshedAt && ` · Cập nhật ${lastRefreshedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
                <button
                  onClick={closeSession}
                  disabled={sessionBusy}
                  className="ml-1 flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  {sessionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                  Kết thúc
                </button>
              </div>
            ) : (
              <button
                onClick={openSession}
                disabled={sessionBusy}
                title="Mở phiên để camera Hanet biết các lượt quét mặt thuộc lớp này. Phiên tự hết hiệu lực sau 3 tiếng."
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {sessionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Bắt đầu điểm danh camera
              </button>
            )
          )}

          <button 
            onClick={saveAttendance}
            disabled={saving || students.length === 0}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Đang lưu..." : "Lưu điểm danh"}
          </button>
        </div>
      </div>

      {sessionError && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{sessionError}</span>
          <button onClick={() => setSessionError("")} className="text-red-600 hover:text-red-800 font-medium">
            Đóng
          </button>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 p-4 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Danh sách lớp</h3>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600 font-medium">Đánh dấu tất cả:</span>
            <button onClick={() => markAllStatus('present')} className="text-green-600 hover:text-green-700 font-medium">Có mặt</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => markAllStatus('absent_with_permission')} className="text-yellow-600 hover:text-yellow-700 font-medium">Nghỉ phép</button>
            <span className="text-slate-300">|</span>
            <button onClick={() => markAllStatus('absent_without_permission')} className="text-red-600 hover:text-red-700 font-medium">Không phép</button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Học viên</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Mã HV</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Trạng thái (Đi học)</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Bài tập VN</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500 flex flex-col items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-slate-400 mb-2" />
                    Chưa có học viên nào trong lớp này.
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const record = attendance[student.id];
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100">
                            {student.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{student.name}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                        {student.studentCode}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex justify-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="radio" 
                              name={`status-${student.id}`} 
                              checked={!record || record.status === 'present'}
                              onChange={() => handleUpdateAttendance(student.id, 'status', 'present')}
                              className="h-4 w-4 text-green-600 focus:ring-green-600 border-slate-300"
                            />
                            <span className="text-sm font-medium text-green-700">Có mặt</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="radio" 
                              name={`status-${student.id}`} 
                              checked={record?.status === 'absent_with_permission'}
                              onChange={() => handleUpdateAttendance(student.id, 'status', 'absent_with_permission')}
                              className="h-4 w-4 text-yellow-600 focus:ring-yellow-600 border-slate-300"
                            />
                            <span className="text-sm font-medium text-yellow-700">Nghỉ (phép)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="radio" 
                              name={`status-${student.id}`} 
                              checked={record?.status === 'absent_without_permission'}
                              onChange={() => handleUpdateAttendance(student.id, 'status', 'absent_without_permission')}
                              className="h-4 w-4 text-red-600 focus:ring-red-600 border-slate-300"
                            />
                            <span className="text-sm font-medium text-red-700">Nghỉ (ko phép)</span>
                          </label>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <label className="flex items-center justify-center cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={record?.homeworkCompleted === 1}
                            onChange={(e) => handleUpdateAttendance(student.id, 'homeworkCompleted', e.target.checked ? 1 : 0)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                          />
                        </label>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <input
                          type="text"
                          value={record?.note || ''}
                          onChange={(e) => handleUpdateAttendance(student.id, 'note', e.target.value)}
                          placeholder="Nhận xét buổi học..."
                          className="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
